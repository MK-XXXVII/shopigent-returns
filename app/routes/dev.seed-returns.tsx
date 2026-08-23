// DEV ONLY — Seed returns across statuses from real Shopify orders.
// Uses MCP-key auth (same as dev.list-returns) so it can run headless via curl.
import { json, type ActionFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
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
    name: e.node.name,
    email: e.node.email || "customer@example.com",
    createdAt: e.node.createdAt,
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

const SEED_STATUSES = ["PENDING", "PENDING", "APPROVED", "APPROVED", "DENIED", "REFUNDED", "REFUNDED", "SHIPPED", "APPROVED", "PENDING"];

export const action = async ({ request }: ActionFunctionArgs) => {
  // MCP key auth (same pattern as dev.list-returns — proven to work headless)
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, { status: 401 });
  const key = authHeader.slice(7);
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const shopRec = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!shopRec) return json({ error: "Invalid key" }, { status: 401 });

  const shop = shopRec.shop;
  // Use the store's offline session token to hit Shopify GraphQL
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = sess?.accessToken;
  if (!token) return json({ error: `No offline token for ${shop}`, hashUsed: hash.slice(0, 8) }, { status: 500 });

  const orders = await fetchOrders(shop, token);
  const before = await prisma.returnRequest.count({ where: { shop } });

  let created = 0;
  for (let i = 0; i < Math.min(SEED_STATUSES.length, orders.length); i++) {
    const o = orders[i];
    const st = SEED_STATUSES[i];
    if (!o) continue;
    const items = o.lineItems.slice(0, Math.min(3, o.lineItems.length)).map((li: any) => ({
      id: li.id, variantId: li.variantId, title: li.title,
      quantity: li.quantity, price: li.price, sku: li.sku,
    }));
    if (items.length === 0) continue;
    // Build a customer name from the email prefix
    const rawName = (o.name || "customer").replace("#", "").split("@")[0].replace(/[._-]/g, " ");
    const customerName = rawName.replace(/\b\w/g, (c: string) => c.toUpperCase());
    await prisma.returnRequest.create({
      data: {
        shop, orderId: `${o.id}-seed-${i}`, orderName: o.name, customerEmail: "customer@example.com", customerName, items,
        reason: st === "DENIED" ? "changed_mind" : "sizing_issue",
        status: st as any,
        decidedBy: ["APPROVED", "REFUNDED", "SHIPPED"].includes(st) ? "auto" : st === "DENIED" ? "admin" : null,
        decidedAt: st !== "PENDING" ? new Date() : null,
        createdAt: new Date(new Date(o.createdAt).getTime() + 1000 * 60 * 60 * (i + 1)),
        refundAmount: st === "REFUNDED" ? items.reduce((s: number, it: any) => s + parseFloat(it.price) * it.quantity, 0) : null,
      },
    });
    created++;
  }

  return json({ ok: true, shop, ordersFound: orders.length, before, created });
};