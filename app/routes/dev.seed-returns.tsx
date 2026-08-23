// DEV ONLY — Seed real Shopify orders into return requests across statuses.
// Opens as a simple HTML page in the Shopify admin (requires auth).
// Use this to generate data for listing screenshots, then clear when done.
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";
import { shopifyAdminQuery } from "../lib/shopify-admin.server";

// ── Fetch orders + line items from Shopify ────────────────────────
async function fetchOrders(shop: string, token: string) {
  const q = `{
    orders(first: 40, sortKey: CREATED_AT, reverse: true) {
      edges { node {
        id name email createdAt displayFinancialStatus
        lineItems(first: 10) { edges { node {
          id title quantity sku variant { id }
          originalUnitPriceSet { shopMoney { amount } }
        } } }
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
      title: li.node.title,
      quantity: li.node.quantity,
      sku: li.node.sku || "",
      variantId: li.node.variant?.id || `gid://shopify/ProductVariant/1`,
      price: li.node.originalUnitPriceSet?.shopMoney?.amount || "0",
    })),
  }));
}

// statuses to spread across the seeded returns (for screenshot variety)
const SEED_STATUSES = ["PENDING", "PENDING", "APPROVED", "APPROVED", "DENIED", "REFUNDED", "REFUNDED", "SHIPPED", "APPROVED", "PENDING"];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = sess?.accessToken || session.accessToken;
  if (!token) return json({ error: "No access token" }, { status: 500 });
  const orders = await fetchOrders(shop, token);

  // Render a tiny bootstrap page with a "Seed demo data" button
  const host = `${request.headers.get("x-forwarded-proto") || "https"}://returns.greeknous.com`;
  return new Response(`<!doctype html><html><body>
    <h2>Shopigent Returns — Dev Seed</h2>
    <p>Store: <b>${shop}</b> · Orders found: <b>${orders.length}</b></p>
    <p>Orders: ${orders.map((o: any) => o.name + " (" + o.email + ")").join(", ") || "none"}</p>
    <form method="post"><button type="submit" style="padding:12px 24px;font-size:16px">Seed ${Math.min(SEED_STATUSES.length, orders.length)} demo returns</button></form>
    <p style="color:#888">After seeding, refresh the Dashboard/Returns/Analytics pages to capture screenshots.</p>
  </body></html>`, { headers: { "Content-Type": "text/html" } });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = sess?.accessToken || session.accessToken;
  if (!token) return json({ error: "No access token" }, { status: 500 });

  const orders = await fetchOrders(shop, token);
  let created = 0;
  for (let i = 0; i < Math.min(SEED_STATUSES.length, orders.length); i++) {
    const o = orders[i];
    const st = SEED_STATUSES[i];
    const items = o.lineItems.slice(0, Math.min(3, o.lineItems.length)).map((li: any) => ({
      id: li.id, variantId: li.variantId, title: li.title,
      quantity: li.quantity, price: li.price, sku: li.sku,
    }));
    if (items.length === 0) continue;
    const customerName = o.email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    await prisma.returnRequest.create({
      data: {
        shop, orderId: o.id, orderName: o.name, customerEmail: o.email, customerName, items,
        reason: st === "DENIED" ? "changed_mind" : "sizing_issue",
        status: st as any,
        decidedBy: ["APPROVED", "REFUNDED", "SHIPPED"].includes(st) ? "auto" : st === "DENIED" ? "admin" : null,
        decidedAt: st !== "PENDING" ? new Date() : null,
        createdAt: new Date(new Date(o.createdAt).getTime() + 1000 * 60 * 30 * (i + 1)),
        refundAmount: st === "REFUNDED" ? items.reduce((s: number, it: any) => s + parseFloat(it.price) * it.quantity, 0) : null,
      },
    });
    created++;
  }
  return json({ ok: true, shop, ordersAvailable: orders.length, created });
};