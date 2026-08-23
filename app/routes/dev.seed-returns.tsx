// DEV ONLY — Seed returns across statuses from real Shopify orders.
// Targets a specific shop via ?shop= (defaults to the MCP-key's shop, or kosmos).
// Uses that shop's OWN offline session from the DB — works even if the MCP
// key resolves to a different store. MCP-key auth gates the endpoint.
import { json, type ActionFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
import prisma from "../lib/db.server";
import { shopifyAdminQuery } from "../lib/shopify-admin.server";

async function fetchOrders(shop: string, token: string) {
  const q = `{
    orders(first: 40, sortKey: CREATED_AT, reverse: true) {
      edges { node {
        id name displayFinancialStatus
        customer { email }
        createdAt
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
    email: e.node.email || e.node.displayName?.first ? `${e.node.displayName.first} ${e.node.displayName.last}` : "Customer",
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
  // --- MCP gate ---
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, { status: 401 });
  const key = authHeader.slice(7);
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const authedShop = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!authedShop) return json({ error: "Invalid key" }, { status: 401 });

  // --- Resolve TARGET shop: ?shop= param wins, else the MCP key's shop ---
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || authedShop.shop;

  // Find THIS store's own offline session (not the MCP-key shop's)
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = sess?.accessToken;
  if (!token) return json({ error: `No offline token for ${shop}` }, { status: 500 });

  const orders = await fetchOrders(shop, token);
  const before = await prisma.returnRequest.count({ where: { shop } });

  let created = 0;
  for (let i = 0; i < Math.min(SEED_STATUSES.length, orders.length); i++) {
    const o = orders[i];
    if (!o) continue;
    const st = SEED_STATUSES[i];
    const items = o.lineItems.slice(0, Math.min(3, o.lineItems.length)).map((li: any) => ({
      id: li.id, variantId: li.variantId, title: li.title,
      quantity: li.quantity, price: li.price, sku: li.sku,
    }));
    if (items.length === 0) continue;
    const customerName = typeof o.email === "string" && o.email.includes("@")
      ? o.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
      : `Customer ${i + 1}`;
    await prisma.returnRequest.create({
      data: {
        shop, orderId: `${o.id}-seed-${i}`, orderName: o.name,
        customerEmail: o.email, customerName, items,
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