// DEV ONLY — list Shopify orders + customers for the store (for screenshot seed data)
import { json } from "@remix-run/node";
import * as crypto from "node:crypto";
import prisma from "../lib/db.server";
import { shopifyAdminQuery } from "../lib/shopify-admin.server";

export const loader = async ({ request }: any) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, { status: 401 });
  const key = authHeader.slice(7);
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const shopRec = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!shopRec) return json({ error: "Invalid key" }, { status: 401 });

  const shop = shopRec.shop;
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  if (!sess?.accessToken) return json({ error: "No offline token" }, { status: 500 });

  // List recent orders
  const ordersQ = `{ orders(first: 20, sortKey: CREATED_AT, reverse: true) { edges { node { id name email displayFinancialStatus createdAt } } } }`;
  const ordersR = await shopifyAdminQuery(shop, sess.accessToken, ordersQ);

  return json({ orders: ordersR?.data?.orders?.edges || ordersR });
};