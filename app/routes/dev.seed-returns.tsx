// DEV ONLY — seed return requests from real Shopify orders into the DB
// Creates returns across all statuses so the merchant can capture screenshots.
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";
import { shopifyAdminQuery } from "../lib/shopify-admin.server";

// Fetch orders with line items from Shopify
async function fetchOrders(shop: string, token: string) {
  const q = `{
    orders(first: 40, sortKey: CREATED_AT, reverse: true) {
      edges { node {
        id name email createdAt displayFinancialStatus
        lineItems(first: 10) { edges { node { id title quantity sku variant { id } originalUnitPriceSet { shopMoney { amount } } } } }
      } }
    }
  }`;
  const r = await shopifyAdminQuery(shop, token, q);
  return (r?.data?.orders?.edges || []).map((e: any) => ({
    id: e.node.id.replace("gid://shopify/Order/", ""),
    gid: e.node.id,
    name: e.node.name,
    email: e.node.email || "customer@example.com",
    createdAt: e.node.createdAt,
    status: e.node.displayFinancialStatus,
    lineItems: (e.node.lineItems?.edges || []).map((li: any) => ({
      id: String(li.node.id).replace("gid://shopify/LineItem/", ""),
      lineItemGid: li.node.id,
      title: li.node.title,
      quantity: li.node.quantity,
      sku: li.node.sku || "",
      variantId: li.node.variant?.id || `gid://shopify/ProductVariant/1`,
      price: li.node.originalUnitPriceSet?.shopMoney?.amount || "0",
    })),
  }));
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = sess?.accessToken || session.accessToken;
  if (!token) return json({ error: "No access token" }, { status: 500 });

  const orders = await fetchOrders(shop, token);
  const statuses = ["PENDING", "PENDING", "APPROVED", "APPROVED", "DENIED", "REFUNDED", "REFUNDED", "SHIPPED", "APPROVED", "PENDING"];

  let created = 0;
  for (let i = 0; i < Math.min(statuses.length, orders.length); i++) {
    const o = orders[i];
    const st = statuses[i];
    const items = o.lineItems.slice(0, Math.min(3, o.lineItems.length)).map((li: any) => ({
      id: li.id,
      variantId: li.variantId,
      title: li.title,
      quantity: li.quantity,
      price: li.price,
      sku: li.sku,
    }));
    if (items.length === 0) continue;

    const customerName = o.email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const arrived = await prisma.returnRequest.create({
      data: {
        shop,
        orderId: o.id,
        orderName: o.name,
        customerEmail: o.email,
        customerName,
        items,
        reason: st === "DENIED" ? "changed_mind" : "sizing_issue",
        status: st as any,
        decidedBy: st === "APPROVED" || st === "REFUNDED" || st === "SHIPPED" ? "auto" : st === "DENIED" ? "admin" : null,
        decidedAt: st !== "PENDING" ? new Date() : null,
        createdAt: new Date(new Date(o.createdAt).getTime() + 1000 * 60 * 30 * (i + 1)),
        refundAmount: st === "REFUNDED" ? items.reduce((s: number, it: any) => s + parseFloat(it.price) * it.quantity, 0) : null,
      },
    });
    created++;
  }

  return json({ ok: true, shop, ordersAvailable: orders.length, created });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = sess?.accessToken || session.accessToken;
  if (!token) return json({ error: "No access token" }, { status: 500 });
  const orders = await fetchOrders(shop, token);
  return json({ shop, ordersAvailable: orders.length, orders });
};