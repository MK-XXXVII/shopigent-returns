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

      default:
        console.log(`[webhook] Unhandled topic: ${topic}`);
    }

    return new Response(null, { status: 200 });
  } catch (error: any) {
    console.error(`[webhook] Error:`, error.message);
    return new Response(error.message, { status: 401 });
  }
};