// Dev: fix a shop's session token
// POST /api/refresh-session?shop=shopigent-kosmos.myshopify.com
// Uses the MCP API key to authorize (any authed shop can trigger this)
// This forces the app to re-request the offline access token
import { json, type ActionFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
import prisma from "../lib/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const authHeader = request.headers.get("authorization");
  const key = authHeader?.slice(7);
  const hash = crypto.createHash("sha256").update(key || "").digest("hex");

  const authedShop = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!authedShop) {
    return json({ error: "Invalid API key" }, { status: 401 });
  }

  const url = new URL(request.url);
  const targetShop = url.searchParams.get("shop") || authedShop.shop;

  // Delete the old offline session so the app re-creates it on next auth
  const deleted = await prisma.session.deleteMany({
    where: { shop: targetShop, isOnline: false },
  });

  return json({
    ok: true,
    shop: targetShop,
    deletedSessions: deleted.count,
    message: "Old session deleted. The app will re-authenticate on next visit. Go to the app in Shopify admin to fix the token.",
  });
};