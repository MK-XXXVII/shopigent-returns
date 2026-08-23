// DEV ONLY — list Shopify orders for whichever shop the MCP key resolves to
import { json } from "@remix-run/node";
import * as crypto from "node:crypto";
import prisma from "../lib/db.server";
import { shopifyAdminQuery } from "../lib/shopify-admin.server";

export const loader = async ({ request }: any) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, { status: 401 });
  const key = authHeader.slice(7);
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const shopRec = await prisma.shop.findUnique({ where: { mcpApiKeyHash: hash } });
  if (!shopRec) return json({ error: "Invalid key — hash not matched", hash: hash.slice(0,12) }, { status: 401 });

  const shop = shopRec.shop;
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  if (!sess?.accessToken) return json({ error: "No offline token", shop }, { status: 500 });

  const ordersQ = `{ orders(first: 25, sortKey: CREATED_AT, reverse: true) { edges { node { id name email displayFinancialStatus createdAt } } } }`;
  const ordersR = await shopifyAdminQuery(shop, sess.accessToken, ordersQ);
  const edges = ordersR?.data?.orders?.edges || [];

  return json({
    shop,
    keyHashPrefix: hash.slice(0, 12),
    orderCount: edges.length,
    orders: edges.map((e: any) => ({
      id: e.node.id,
      name: e.node.name,
      email: e.node.email,
      status: e.node.displayFinancialStatus,
      created: e.node.createdAt,
    })),
  });
};