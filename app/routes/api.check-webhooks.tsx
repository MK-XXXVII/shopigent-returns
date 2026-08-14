// DEV: list registered webhooks for a shop (protected by MCP key)
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

  const query = `{ webhookSubscriptions(first: 50) { edges { node { ... on WebhookSubscription { id topic endpoint { ... on WebhookHttpEndpoint { callbackUrl } } } } } } }`;
  const res = await fetch(`https://${shop}/admin/api/2026-10/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  const subs = data?.data?.webhookSubscriptions?.edges?.map((e: any) => e.node) || [];
  const topics = subs.map((s: any) => s.topic);
  return json({ shop, topics, hasReturnsUpdate: topics.includes("RETURNS_UPDATE") });
};
