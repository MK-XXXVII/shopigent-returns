import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  InlineStack,
  Button,
  List,
  Tag,
  Banner,
  Box,
} from "@shopify/polaris";
import { useEffect } from "react";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";
import { issueConfirmationToken, verifyConfirmationToken } from "../lib/confirmation.server";
import { executeRefund, shopifyAdminQuery } from "../lib/shopify-admin.server";
import { approveShopifyReturn, declineShopifyReturn, closeShopifyReturn } from "../lib/shopify-return.server";
import { generateAndEmailReturnLabel } from "../lib/return-label-notify.server";
import { syncReturnFromShopify } from "../lib/shopify-sync.server";
import { sendEmail, returnApprovedEmail, returnDeniedEmail, refundProcessedEmail } from "../lib/email.server";

const STATUS_COLORS: Record<string, "success" | "warning" | "critical" | "info" | "new"> = {
  PENDING: "warning",
  APPROVED: "info",
  DENIED: "critical",
  EXCHANGE: "info",
  SHIPPED: "new",
  REFUNDED: "success",
  CLOSED: "info",
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;
  let returnReq = await prisma.returnRequest.findFirst({
    where: { id: params.id, shop },
    include: {
      fraudSignals: true,
      decisionLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!returnReq) throw new Response("Not found", { status: 404 });

  // Bidirectional sync: live-check the Shopify return status on load
  try {
    await syncReturnFromShopify(shop, (returnReq as any).shopifyReturnId, (returnReq as any).id);
    // Re-fetch to reflect any synced change
    returnReq = await prisma.returnRequest.findFirst({
      where: { id: params.id, shop },
      include: {
        fraudSignals: true,
        decisionLogs: { orderBy: { createdAt: "desc" } },
      },
    });
  } catch (err: any) {
    console.error(`[sync] Load sync failed: ${err.message}`);
  }

  return json({ return: returnReq });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("_action") as string;
  const returnId = params.id!;
  const shop = session.shop;

  const returnReq = await prisma.returnRequest.findFirst({
    where: { id: returnId, shop },
  });
  if (!returnReq) {
    return json({ error: "Return not found" }, { status: 404 });
  }

  // Only PENDING-status actions require the return to be PENDING
  if (action === "issue_token" || action === "approve" || action === "deny") {
    if (returnReq.status !== "PENDING") {
      return json({ error: "Return is not pending; cannot approve/deny" }, { status: 400 });
    }
  }

  if (action === "issue_token") {
    const secret = process.env.CONFIRMATION_TOKEN_SECRET;
    if (!secret) return json({ error: "Not configured" }, { status: 500 });
    const token = issueConfirmationToken(secret, shop, formData.get("target") as string || "approve_return", returnId, { returnId });
    return json({ token, expiresInMs: 300000 });
  }

  if (action === "approve" || action === "deny") {
    const secret = process.env.CONFIRMATION_TOKEN_SECRET;
    if (!secret) return json({ error: "Not configured" }, { status: 500 });
    const token = formData.get("confirmationToken") as string;
    if (!token) return json({ error: "Confirmation token required. Click Issue Token first." }, { status: 400 });

    const targetAction = action === "approve" ? "approve_return" : "deny_return";
    // The issued token is scoped to this returnId+shop but bound to one action;
    // accept it for either approve or deny so a single token covers both decisions.
    let check = verifyConfirmationToken(token, secret, shop, targetAction, returnId, { returnId });
    if (!check.valid) {
      const otherAction = action === "approve" ? "deny_return" : "approve_return";
      check = verifyConfirmationToken(token, secret, shop, otherAction, returnId, { returnId });
    }
    if (!check.valid) return json({ error: `Token invalid: ${check.reason}` }, { status: 400 });

    if (action === "approve") {
      const claim = await prisma.returnRequest.updateMany({
        where: { id: returnId, status: "PENDING" },
        data: { status: "APPROVED", decidedBy: "admin", decidedAt: new Date() },
      });
      if (claim.count === 0) return json({ error: "Already processed" });

      // Fetch offline session for Shopify sync
      let sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
      if (!sess?.accessToken) {
        sess = await prisma.session.findFirst({ where: { shop } });
      }
      // NOTE: Approve does NOT auto-refund. The merchant decides on the refund
      // separately via the "Process Refund" button after receiving the item back.
      // Sync approve to Shopify if a Shopify return exists
      if (sess?.accessToken && returnReq.shopifyReturnId) {
        try {
          const approved = await approveShopifyReturn(shop, sess.accessToken, returnReq.shopifyReturnId);
          if (approved.success) {
            await prisma.decisionLog.create({ data: { returnId, actor: "admin", action: "shopify_approve", details: { returnId: returnReq.shopifyReturnId } } });
          } else {
            console.error(`[admin] Shopify approve failed: ${approved.error}`);
          }
        } catch (e: any) {
          console.error(`[admin] Shopify approve error: ${e.message}`);
        }
      }
      await prisma.decisionLog.create({ data: { returnId, actor: "admin", action: "approve", details: { source: "detail_page" } } });
      if (returnReq.customerEmail) sendEmail({ ...returnApprovedEmail(returnReq.customerName || "Customer", returnReq.orderName || ""), to: returnReq.customerEmail });

      // Generate + email return shipping label
      if (returnReq.customerEmail) {
        const labelInfo = await generateAndEmailReturnLabel(shop, returnReq, { allowTest: true });
        if (labelInfo.success && labelInfo.labelUrl) {
          const labels = (returnReq.labels as any[]) || [];
          labels.push({ type: "return_shipping", url: labelInfo.labelUrl, trackingNumber: labelInfo.trackingNumber || null, createdAt: new Date().toISOString() });
          await prisma.returnRequest.update({ where: { id: returnId }, data: { labels } });
          await prisma.decisionLog.create({ data: { returnId, actor: "admin", action: "label_sent", details: { url: labelInfo.labelUrl } } });
        } else if (labelInfo.error) {
          console.error(`[admin] Label generation failed: ${labelInfo.error}`);
        }
      }
      return json({ success: true, message: "✅ Return approved! Label sent to customer.", newStatus: "APPROVED" });
    } else {
      const claim = await prisma.returnRequest.updateMany({
        where: { id: returnId, status: "PENDING" },
        data: { status: "DENIED", decidedBy: "admin", decidedAt: new Date(), notes: "Denied by admin" },
      });
      if (claim.count === 0) return json({ error: "Already processed" });
      // Sync deny to Shopify if a Shopify return exists
      let sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
      if (!sess?.accessToken) sess = await prisma.session.findFirst({ where: { shop } });
      if (sess?.accessToken && returnReq.shopifyReturnId) {
        try {
          const declined = await declineShopifyReturn(shop, sess.accessToken, returnReq.shopifyReturnId);
          if (declined.success) {
            await prisma.decisionLog.create({ data: { returnId, actor: "admin", action: "shopify_decline", details: { returnId: returnReq.shopifyReturnId } } });
          } else {
            console.error(`[admin] Shopify decline failed: ${declined.error}`);
          }
        } catch (e: any) {
          console.error(`[admin] Shopify decline error: ${e.message}`);
        }
      }
      await prisma.decisionLog.create({ data: { returnId, actor: "admin", action: "deny", details: { source: "detail_page" } } });
      if (returnReq.customerEmail) sendEmail({ ...returnDeniedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", "Denied by store admin"), to: returnReq.customerEmail });
      return json({ success: true, message: "❌ Return denied", newStatus: "DENIED" });
    }
  }

  // Process return from the app — generate label + email customer (for APPROVED/SHIPPED)
  if (action === "process_return") {
    if (returnReq.status === "PENDING") {
      return json({ error: "Approve the return first before processing" }, { status: 400 });
    }
    if (returnReq.customerEmail) {
      const labelInfo = await generateAndEmailReturnLabel(shop, returnReq, { allowTest: true });
      if (labelInfo.success && labelInfo.labelUrl) {
        const labels = (returnReq.labels as any[]) || [];
        labels.push({ type: "return_shipping", url: labelInfo.labelUrl, trackingNumber: labelInfo.trackingNumber || null, createdAt: new Date().toISOString() });
        await prisma.returnRequest.update({ where: { id: returnId }, data: { status: "SHIPPED", labels } });
        await prisma.decisionLog.create({ data: { returnId, actor: "admin", action: "process", details: { url: labelInfo.labelUrl } } });
        return json({ success: true, message: "📦 Return label sent to customer!", newStatus: "SHIPPED" });
      }
      return json({ error: labelInfo.error || "Failed to generate label" }, { status: 500 });
    }
    return json({ error: "No customer email on file" }, { status: 400 });
  }

  // Process refund from the app — execute Shopify refund + email customer
  if (action === "process_refund") {
    if (returnReq.status === "PENDING") {
      return json({ error: "Approve the return first before refunding" }, { status: 400 });
    }
    if (returnReq.status === "REFUNDED") {
      return json({ error: "Return already refunded" }, { status: 400 });
    }
    let sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
    if (!sess?.accessToken) sess = await prisma.session.findFirst({ where: { shop } });
    if (!sess?.accessToken) return json({ error: "No access token" }, { status: 500 });

    const amount = (returnReq.items as any[]).reduce((s: number, i: any) => s + (parseFloat(i.price || "0") * (i.quantity || 0)), 0);
    try {
      const result = await executeRefund(shop, sess.accessToken, returnReq.orderId, amount, true);
      const refundId = result?.id || null;
      await prisma.returnRequest.update({
        where: { id: returnId },
        data: { status: "REFUNDED", refundAmount: amount, refundId },
      });
      await prisma.decisionLog.create({ data: { returnId, actor: "admin", action: "refund", details: { refundId, amount } } });
      if (returnReq.customerEmail) sendEmail({ ...refundProcessedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", amount), to: returnReq.customerEmail });
      // Close the Shopify return so its state on the order matches (returnClose)
      if (returnReq.shopifyReturnId) {
        try {
          const closeResult = await closeShopifyReturn(shop, sess.accessToken, returnReq.shopifyReturnId);
          if (closeResult.success) {
            console.log(`[process_refund] Closed Shopify return ${returnReq.shopifyReturnId}`);
          } else {
            console.log(`[process_refund] Close Shopify return returned: ${closeResult.error}`);
          }
        } catch (e: any) {
          console.error(`[process_refund] Close Shopify return failed: ${e.message}`);
        }
      }
      return json({ success: true, message: "💰 Refund processed!", newStatus: "REFUNDED" });
    } catch (err: any) {
      return json({ error: `Refund failed: ${err.message}` }, { status: 500 });
    }
  }

  // Cancel/deny an approved return from the app (no confirmation token needed)
  if (action === "cancel_approved") {
    if (returnReq.status !== "APPROVED" && returnReq.status !== "SHIPPED") {
      return json({ error: "Only approved/shipped returns can be cancelled" }, { status: 400 });
    }
    let sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
    if (!sess?.accessToken) sess = await prisma.session.findFirst({ where: { shop } });
    // Decline in Shopify if still open
    if (sess?.accessToken && returnReq.shopifyReturnId) {
      try {
        await declineShopifyReturn(shop, sess.accessToken, returnReq.shopifyReturnId);
        await closeShopifyReturn(shop, sess.accessToken, returnReq.shopifyReturnId);
      } catch {}
    }
    await prisma.returnRequest.update({
      where: { id: returnId },
      data: { status: "DENIED" },
    });
    await prisma.decisionLog.create({
      data: { returnId, actor: "admin", action: "cancel", details: { from: returnReq.status } },
    });
    if (returnReq.customerEmail) sendEmail({
      ...returnDeniedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", "Return cancelled by store"),
      to: returnReq.customerEmail,
    });
    return json({ success: true, message: "❌ Return cancelled/denied", newStatus: "DENIED" });
  }

  // Close return on Shopify (for REFUNDED returns where Shopify return is still OPEN)
  if (action === "close_return") {
    let sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
    if (!sess?.accessToken) sess = await prisma.session.findFirst({ where: { shop } });
    if (!sess?.accessToken) return json({ error: "No access token" }, { status: 500 });

    // Look up Shopify return ID — if not stored, query Shopify by orderId
    let shopifyReturnId = returnReq.shopifyReturnId;
    if (!shopifyReturnId) {
      try {
        const r = await shopifyAdminQuery(shop, sess.accessToken, "query { order(id: 'gid://shopify/Order/" + returnReq.orderId + "') { returns(first: 1) { nodes { id status } } } }");
        const found = r?.data?.order?.returns?.nodes?.[0];
        if (found) shopifyReturnId = found.id;
      } catch {}
    }
    if (!shopifyReturnId) {
      return json({ error: "No Shopify return found for this order" }, { status: 400 });
    }

    try {
      const closeResult = await closeShopifyReturn(shop, sess.accessToken, shopifyReturnId);
      if (closeResult.success) {
        await prisma.returnRequest.update({
          where: { id: returnId },
          data: { shopifyReturnId },
        });
        await prisma.decisionLog.create({
          data: { returnId, actor: "admin", action: "close_return", details: { returnId: shopifyReturnId } },
        });
        return json({ success: true, message: `🔒 Shopify return closed!`, newStatus: returnReq.status });
      }
      return json({ error: closeResult.error || "Close failed" }, { status: 500 });
    } catch (err: any) {
      return json({ error: `Close failed: ${err.message}` }, { status: 500 });
    }
  }

  return json({ error: "Unknown action" });
};

export default function ReturnDetailPage() {
  const { return: r } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const items = r.items as any[];
  const logs = r.decisionLogs;
  const isPending = r.status === "PENDING";

  const actionData = fetcher.data;
  const hasToken = actionData?.token;
  const isSuccess = actionData?.success;
  const isError = actionData?.error;
  const navigate = useNavigate();

  // Auto-refresh after successful action (approve, deny, refund, close)
  useEffect(() => {
    if (fetcher.data?.success && fetcher.state === "idle") {
      window.location.reload();
    }
  }, [fetcher.data, fetcher.state]);

  return (
    <Page
      title={`Return ${r.orderName || r.id.slice(0, 8)}`}
      backAction={{ onAction: () => {
                    if (window.history.length > 1) navigate(-1);
                    else navigate("/");
                  } }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Status + Actions */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" gap="400" wrap={false}>
                  <div style={{ minWidth: 120 }}>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h2" fontWeight="bold">
                      Status
                    </Text>
                    <Badge tone={STATUS_COLORS[r.status] || "info"}>
                      {r.status}
                    </Badge>
                  </BlockStack>
                  </div>

                  <div style={{ minWidth: 320, flex: 1 }}>
                  <BlockStack gap="300" align="end">
                    {r.status === "PENDING" && (
                      <>
                        {!hasToken ? (
                          <BlockStack gap="200" align="end">
                            <Box background="bg-surface-secondary" borderWidth="025" borderColor="border" padding="400" borderRadius="300" width="100%">
                              <BlockStack gap="300">
                                <InlineStack gap="200" blockAlign="center">
                                  <span style={{ color: "#b97800" }}>
                                    <svg viewBox="0 0 20 20" width="20" height="20"><path d="M10 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 13a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1ZM2.7 6.1a1 1 0 0 1 1.4 0l.7.7a1 1 0 0 1-1.4 1.4l-.7-.7a1 1 0 0 1 0-1.4Zm11.4 0a1 1 0 0 1 1.4 0l.7.7a1 1 0 1 1-1.4 1.4l-.7-.7a1 1 0 0 1 0-1.4ZM2.7 13.9a1 1 0 0 1 0-1.4l.7-.7a1 1 0 0 1 1.4 1.4l-.7.7a1 1 0 0 1-1.4 0Zm11.4 0a1 1 0 0 1 1.4 0l.7.7a1 1 0 1 1-1.4 1.4l-.7-.7a1 1 0 0 1 0-1.4Zm-7 3.25V19a1 1 0 1 1-2 0v-1.85a3.9 3.9 0 0 1-3.4-3.65A1 1 0 0 1 3 12.5h14a1 1 0 0 1 1 1 3.9 3.9 0 0 1-3.4 3.65V19a1 1 0 1 1-2 0v-1.85A3.9 3.9 0 0 1 9.2 19h-2Z"/></svg>
                                  </span>
                                  <Text variant="bodySm" as="span" fontWeight="medium">Two-step confirmation</Text>
                                </InlineStack>
                                <Text variant="bodySm" as="p" tone="subdued">
                                  Issue a security token, then confirm your decision to approve or deny this return.
                                </Text>
                                <Button
                                  variant="secondary"
                                  fullWidth
                                  onClick={() => fetcher.submit({ _action: "issue_token", target: "approve_return" }, { method: "post" })}
                                  loading={fetcher.state !== "idle"}
                                >
                                  Issue Confirmation Token
                                </Button>
                              </BlockStack>
                            </Box>
                          </BlockStack>
                        ) : (
                          <BlockStack gap="200" align="end">
                            <InlineStack gap="200" blockAlign="center" align="end">
                              <span style={{ color: "#297260" }}>
                                <svg viewBox="0 0 20 20" width="18" height="18"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm1-11a1 1 0 1 0-2 0v4a1 1 0 0 0 .3.7l2 2a1 1 0 0 0 1.4-1.4L11 10.6V7Z" clipRule="evenodd"/></svg>
                              </span>
                              <Text variant="bodySm" as="span" fontWeight="medium">
                                Token issued — ready to confirm your decision
                              </Text>
                            </InlineStack>
                            <div style={{ minWidth: 240, maxWidth: 260 }}>
                              <InlineStack gap="200" align="end">
                              <Button variant="primary" tone="success" onClick={() => fetcher.submit({ _action: "approve", confirmationToken: actionData.token }, { method: "post" })} loading={fetcher.state !== "idle"}>
                                Approve return
                              </Button>
                              <Button tone="critical" disabled={fetcher.state !== "idle"} onClick={() => fetcher.submit({ _action: "deny", confirmationToken: actionData.token }, { method: "post" })}>
                                Deny return
                              </Button>
                            </InlineStack>
                            </div>
                            <Text variant="bodySm" as="p" tone="subdued" alignment="end">
                              Approve sends the return label and marks it approved. Deny closes the return without a refund.
                            </Text>
                          </BlockStack>
                        )}
                      </>
                    )}
                    {r.status === "APPROVED" && (
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <div style={{ minWidth: 240, maxWidth: 260 }}>
                          <Button variant="primary" fullWidth onClick={() => fetcher.submit({ _action: "process_return" }, { method: "post" })} loading={fetcher.state !== "idle"}>
                            📦 Process Return (Send Label)
                          </Button>
                        </div>
                      </div>
                    )}
                    {(r.status === "SHIPPED" || r.status === "APPROVED") && (
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <div style={{ minWidth: 240, maxWidth: 260 }}>
                          <Button variant="primary" tone="success" fullWidth onClick={() => fetcher.submit({ _action: "process_refund" }, { method: "post" })} loading={fetcher.state !== "idle"}>
                            💰 Process Refund
                          </Button>
                        </div>
                      </div>
                    )}
                    {(r.status === "APPROVED" || r.status === "SHIPPED") && (
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <div style={{ minWidth: 240, maxWidth: 260 }}>
                          <Button tone="critical" fullWidth onClick={() => fetcher.submit({ _action: "cancel_approved" }, { method: "post" })} loading={fetcher.state !== "idle"}>
                            ❌ Cancel Return
                          </Button>
                        </div>
                      </div>
                    )}
                    {r.status === "REFUNDED" && (
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <div style={{ minWidth: 240, maxWidth: 260 }}>
                          <Button fullWidth onClick={() => fetcher.submit({ _action: "close_return" }, { method: "post" })} loading={fetcher.state !== "idle"}>
                            🔒 Close Return on Shopify
                          </Button>
                        </div>
                      </div>
                    )}
                  </BlockStack>
                  </div>
                </InlineStack>
                {/* Global action feedback — shows for any action regardless of status */}
                {isError && <Banner tone="critical">{actionData.error}</Banner>}
                {isSuccess && <Banner tone="success">{actionData.message}</Banner>}
                {r.customerName && (
                  <Text variant="bodyMd" as="p">
                    <strong>Customer:</strong> {r.customerName} {r.customerEmail && `(${r.customerEmail})`}
                  </Text>
                )}
                {r.reason && (
                  <Text variant="bodyMd" as="p">
                    <strong>Reason:</strong> {r.reason}
                  </Text>
                )}
                {r.notes && (
                  <Text variant="bodyMd" as="p">
                    <strong>Notes:</strong> {r.notes}
                  </Text>
                )}
                <Text variant="bodySm" as="p" tone="subdued">
                  Created: {new Date(r.createdAt).toLocaleString()}
                </Text>
              </BlockStack>
            </Card>

            {/* Items */}
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2" fontWeight="bold">
                  Items ({items.length})
                </Text>
                {items.map((item: any, i: number) => (
                  <BlockStack key={i} gap="200">
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="span" fontWeight="bold">
                        {item.title}
                      </Text>
                      <Text variant="bodyMd" as="span">
                        x{item.quantity} {item.price && `$${item.price}`}
                      </Text>
                    </InlineStack>
                    {item.sku && <Tag>{item.sku}</Tag>}
                    {item.reason && (
                      <Text variant="bodySm" as="p" tone="subdued">
                        Reason: {item.reason}
                      </Text>
                    )}
                  </BlockStack>
                ))}
              </BlockStack>
            </Card>

            {/* Fraud Signals */}
            {r.fraudSignals.length > 0 && (
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2" fontWeight="bold">
                    Fraud Signals
                  </Text>
                  {r.fraudSignals.map((s) => (
                    <InlineStack key={s.id} gap="200">
                      <Badge tone={s.score > 0.5 ? "critical" : "warning"}>
                        {(s.score * 100).toFixed(0)}%
                      </Badge>
                      <Text variant="bodyMd" as="span">{s.signal}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </Card>
            )}

            {/* Decision Log */}
            {logs.length > 0 && (
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2" fontWeight="bold">
                    Activity Log
                  </Text>
                  {logs.map((log) => (
                    <BlockStack key={log.id} gap="200">
                      <InlineStack gap="200">
                        <Text variant="bodySm" as="span" fontWeight="bold">
                          {log.actor}
                        </Text>
                        <Tag>{log.action}</Tag>
                        <Text variant="bodySm" as="span" tone="subdued">
                          {new Date(log.createdAt).toLocaleString()}
                        </Text>
                      </InlineStack>
                    </BlockStack>
                  ))}
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}