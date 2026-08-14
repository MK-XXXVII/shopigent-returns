// DEV: list registered webhooks for a shop (protected by MCP key) via REST
import { json, type ActionFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
import prisma from "../lib/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const authHeader = request.headers.get("authorization");
  const body = await request.json().catch(() => ({}));
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, { status: 401 });
  const hash = crypto.createHash("sha256").update(authHeader.slice(7)).digest("hex");
  const shopRec = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!shopRec) return json({ error: "Unauthorized" }, { status: 401 });
  const shop = body.shop || shopRec.shop;
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = sess?.accessToken || (await prisma.session.findFirst({ where: { shop } }))?.accessToken;
  if (!token) return json({ error: "No access token" }, { status: 500 });

  const res = await fetch(`https://${shop}/admin/api/2026-10/webhooks.json`, {
    headers: { "X-Shopify-Access-Token": token },
  });
  const data = await res.json();
  const hooks = data?.webhooks || [];

  // Also fetch the returns for the shop's orders to inspect statuses
  let returnsResult = null;
  if (body.orderId) {
    const orderGid = body.orderId.startsWith("gid://") ? body.orderId : `gid://shopify/Order/${body.orderId}`;
    const q = `{ order(id: "${orderGid}") { id name returns(first: 10) { nodes { id status } } } }`;
    const gRes = await fetch(`https://${shop}/admin/api/2026-10/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: q }),
    });
    returnsResult = await gRes.json();
  }

  return json({
    shop,
    resStatus: res.status,
    webhooks: hooks.map((h: any) => ({ topic: h.topic, address: h.address, id: h.id })),
    returns: returnsResult,
  });
};
