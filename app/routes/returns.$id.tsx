import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
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
} from "@shopify/polaris";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";
import { issueConfirmationToken, verifyConfirmationToken } from "../lib/confirmation.server";
import { executeRefund } from "../lib/shopify-admin.server";
import { sendEmail, returnApprovedEmail, returnDeniedEmail } from "../lib/email.server";

const STATUS_COLORS: Record<string, "success" | "warning" | "critical" | "info" | "new"> = {
  PENDING: "warning", APPROVED: "success", DENIED: "critical",
  EXCHANGE: "info", SHIPPED: "info", REFUNDED: "success", CLOSED: "new",
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const returnReq = await prisma.returnRequest.findFirst({
    where: { id: params.id, shop: session.shop },
    include: {
      fraudSignals: true,
      decisionLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!returnReq) throw new Response("Not found", { status: 404 });

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
  if (!returnReq || returnReq.status !== "PENDING") {
    return json({ error: "Return not available" }, { status: 400 });
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
    const check = verifyConfirmationToken(token, secret, shop, targetAction, returnId, { returnId });
    if (!check.valid) return json({ error: `Token invalid: ${check.reason}` }, { status: 400 });

    if (action === "approve") {
      const claim = await prisma.returnRequest.updateMany({
        where: { id: returnId, status: "PENDING" },
        data: { status: "APPROVED", decidedBy: "admin", decidedAt: new Date() },
      });
      if (claim.count === 0) return json({ error: "Already processed" });

      const amount = (returnReq.items as any[]).reduce((s: number, i: any) => s + (parseFloat(i.price || "0") * (i.quantity || 0)), 0);
      // Try offline session first, then any available session
      let sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
      if (!sess?.accessToken) {
        sess = await prisma.session.findFirst({ where: { shop } });
      }
      if (sess?.accessToken) {
        try {
          console.log(`[admin] Attempting refund for ${returnReq.orderId} (${returnReq.orderName}) — amount: $${amount}`);
          const result = await executeRefund(shop, sess.accessToken, returnReq.orderId, amount, true);
          console.log(`[admin] Refund executed: ${result?.id || "no ID"}`);
          await prisma.returnRequest.update({
            where: { id: returnId },
            data: { status: "REFUNDED", refundAmount: amount, refundId: result?.id || null },
          });
        } catch (err: any) {
          console.error(`[admin] Refund failed: ${err.message}`);
        }
      }
      await prisma.decisionLog.create({ data: { returnId, actor: "admin", action: "approve", details: { source: "detail_page" } } });
      if (returnReq.customerEmail) sendEmail({ ...returnApprovedEmail(returnReq.customerName || "Customer", returnReq.orderName || ""), to: returnReq.customerEmail });
      return json({ success: true, message: "✅ Return approved!", newStatus: "APPROVED" });
    } else {
      const claim = await prisma.returnRequest.updateMany({
        where: { id: returnId, status: "PENDING" },
        data: { status: "DENIED", decidedBy: "admin", decidedAt: new Date(), notes: "Denied by admin" },
      });
      if (claim.count === 0) return json({ error: "Already processed" });
      await prisma.decisionLog.create({ data: { returnId, actor: "admin", action: "deny", details: { source: "detail_page" } } });
      if (returnReq.customerEmail) sendEmail({ ...returnDeniedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", "Denied by store admin"), to: returnReq.customerEmail });
      return json({ success: true, message: "❌ Return denied", newStatus: "DENIED" });
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

  return (
    <Page
      title={`Return ${r.orderName || r.id.slice(0, 8)}`}
      backAction={{ url: "/returns" }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Status + Actions */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2" fontWeight="bold">
                      Status
                    </Text>
                    <Badge tone={STATUS_COLORS[r.status] || "info"}>
                      {r.status}
                    </Badge>
                  </BlockStack>
                  {r.status === "PENDING" && (
                      <BlockStack gap="200">
                        <InlineStack gap="200">
                          {hasToken ? (
                            <>
                              <Button variant="primary" tone="success" onClick={() => fetcher.submit({ _action: "approve", confirmationToken: actionData.token }, { method: "post" })} loading={fetcher.state !== "idle"}>
                                ✅ Confirm Approve
                              </Button>
                              <Button tone="critical" onClick={() => fetcher.submit({ _action: "deny", confirmationToken: actionData.token }, { method: "post" })} loading={fetcher.state !== "idle"}>
                                ❌ Confirm Deny
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button onClick={() => fetcher.submit({ _action: "issue_token", target: "approve_return" }, { method: "post" })} loading={fetcher.state !== "idle"}>
                                🔐 Issue Confirmation Token
                              </Button>
                            </>
                          )}
                        </InlineStack>
                        {isError && <Banner tone="critical">{actionData.error}</Banner>}
                        {isSuccess && <Banner tone="success">{actionData.message}</Banner>}
                        {hasToken && !isSuccess && (
                          <Text variant="bodySm" as="p" tone="subdued">Token issued. Click Confirm Approve or Confirm Deny to proceed.</Text>
                        )}
                      </BlockStack>
                  )}
                </InlineStack>
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
                  <BlockStack key={i} gap="100">
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
                    <BlockStack key={log.id} gap="100">
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