// Webhook handler for Shopify webhooks
// Topics: APP_UNINSTALLED, ORDERS_FULFILLED, CUSTOMERS_DATA_REQUEST, PRIVACY_REDACT

import { json, type ActionFunctionArgs } from "@remix-run/node";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop, session, admin } = await shopify.authenticate.webhook(request);
    const payload = await request.json();

    console.log(`[webhook] Received ${topic} for ${shop}`);

    switch (topic) {
      case "APP_UNINSTALLED": {
        await prisma.shop.updateMany({
          where: { shop },
          data: { uninstalledAt: new Date() },
        });
        console.log(`[webhook] Shop uninstalled: ${shop}`);
        break;
      }

      case "ORDERS_FULFILLED": {
        const orderId = payload.id;
        const orderName = payload.name || `#${orderId}`;
        const customerEmail = payload.email || payload.contact_email || "";
        const customerName = payload.customer
          ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim()
          : "";
        const lineItems = (payload.line_items || []).map((item: any) => ({
          variantId: `gid://shopify/ProductVariant/${item.variant_id}`,
          title: item.title,
          quantity: item.quantity,
          price: item.price || "0",
          sku: item.sku || "",
        }));

        // Check if return already exists for this order
        const existing = await prisma.returnRequest.findFirst({
          where: { shop, orderId: `gid://shopify/Order/${orderId}` },
        });

        if (existing) {
          console.log(`[webhook] Return already exists for order ${orderName}, skipping`);
          break;
        }

        await prisma.returnRequest.create({
          data: {
            shop,
            orderId: `gid://shopify/Order/${orderId}`,
            orderName,
            customerEmail,
            customerName,
            items: lineItems,
            status: "PENDING",
          },
        });

        console.log(`[webhook] Created return for order ${orderName} (${lineItems.length} items)`);
        break;
      }

      case "CUSTOMERS_DATA_REQUEST":
      case "CUSTOMERS_REDACT":
      case "SHOP_REDACT": {
        // GDPR compliance — log and acknowledge
        console.log(`[webhook] GDPR ${topic} for ${shop}`);
        break;
      }

      case "RETURNS_UPDATE": {
        // Bidirectional sync: Shopify return changed (status, refund, etc.) → update our record
        await handleReturnsUpdate(shop, payload);
        break;
      }

      case "APP_SUBSCRIPTIONS_UPDATE": {
        // Reconcile billing after a merchant approves/cancels/expires a plan.
        // Shopify owns the subscription lifecycle via Managed pricing; this
        // webhook keeps our local plan row in sync (mirrors the approved
        // shopigent app pattern).
        const sub = (payload as any).app_subscription;
        if (sub) {
          const planName = String(sub.name || "").toLowerCase();
          const statusMap: Record<string, string> = {
            ACTIVE: "active",
            CANCELLED: "cancelled",
            EXPIRED: "cancelled",
            FROZEN: "past_due",
            PENDING: "trialing",
          };
          const status = statusMap[sub.status] ?? "active";
          // Guard: don't let a stale CANCELLED webhook downgrade a newer
          // active/trialing subscription.
          const current = await prisma.shop.findUnique({ where: { shop } });
          if (
            status === "cancelled" &&
            (current?.planStatus === "active" || current?.planStatus === "trialing")
          ) {
            console.log(`[webhook] Skipping CANCELLED subscription webhook for ${shop} (newer active)`);
            break;
          }
          await prisma.shop.updateMany({
            where: { shop },
            data: {
              planName: status === "cancelled" ? "free" : (planName || current?.planName || "free"),
              planStatus: status,
            },
          });
          console.log(`[webhook] Plan reconciled for ${shop}: ${planName || "free"} (${status})`);
        }
        break;
      }

      default:
        console.log(`[webhook] Unhandled topic: ${topic}`);
    }

    return new Response(null, { status: 200 });
  } catch (error: any) {
    console.error(`[webhook] Error:`, error.message);
    return new Response(error.message, { status: 401 });
  }
};

// Map Shopify Return status → our ReturnStatus
function mapShopifyReturnStatus(shopifyStatus: string | undefined): string {
  switch ((shopifyStatus || "").toUpperCase()) {
    case "OPEN": return "APPROVED";            // return approved, processing
    case "PARTIALLY_REFUNDED": return "APPROVED";
    case "REFUNDED":
    case "COMPLETED": return "REFUNDED";       // fully refunded
    case "CANCELLED":
    case "DECLINED": return "DENIED";
    case "REQUESTED": return "PENDING";
    case "CLOSED": return "CLOSED";
    case "REVIEWING": return "PENDING";
    default: return (shopifyStatus || "PENDING").toUpperCase();
  }
}

async function handleReturnsUpdate(shop: string, payload: any) {
  const shopifyReturnId = payload.id;
  const shopifyStatus = payload.status;
  const orderId = payload.order?.id || payload.order_id || null;

  if (!shopifyReturnId) {
    console.error(`[webhook] RETURNS_UPDATE missing id:`, JSON.stringify(payload).slice(0, 500));
    return;
  }

  // Find our return by the Shopify return ID
  let returnReq = await prisma.returnRequest.findFirst({
    where: { shop, shopifyReturnId },
  });

  // Fallback: match by orderId
  if (!returnReq && orderId) {
    returnReq = await prisma.returnRequest.findFirst({
      where: { shop, orderId, status: { not: "REFUNDED" } },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!returnReq) {
    console.log(`[webhook] No matching return for Shopify return ${shopifyReturnId}`);
    return;
  }

  const mappedStatus = mapShopifyReturnStatus(shopifyStatus);
  const oldStatus = returnReq.status;

  // Don't downgrade an already-refunded return to approved
  if (oldStatus === "REFUNDED" && mappedStatus !== "REFUNDED") {
    console.log(`[webhook] Keeping REFUNDED (Shopify says ${mappedStatus}) for ${shopifyReturnId}`);
    return;
  }

  const updates: any = { status: mappedStatus };
  // Capture refund amount/id if present
  const refund = payload.refunds?.[0] || payload.refund;
  if (refund) {
    if (refund.id) updates.refundId = String(refund.id);
    if (refund.transactions?.[0]?.amount) {
      updates.refundAmount = parseFloat(refund.transactions[0].amount);
    }
  }
  if (payload.refund_line_items && !((returnReq.items as any[]) || []).length) {
    updates.items = payload.refund_line_items.map((li: any) => ({
      title: li.line_item?.title || li.title || "Item",
      quantity: li.quantity || 1,
      price: li.price || "0",
    }));
  }

  await prisma.returnRequest.update({
    where: { id: returnReq.id },
    data: updates,
  });

  await prisma.decisionLog.create({
    data: { returnId: returnReq.id, actor: "shopify_webhook", action: "status_sync", details: { from: oldStatus, to: mappedStatus, shopifyStatus, returnId: shopifyReturnId } },
  });

  console.log(`[webhook] Synced return ${returnReq.id}: ${oldStatus} → ${mappedStatus} (Shopify ${shopifyStatus})`);
}