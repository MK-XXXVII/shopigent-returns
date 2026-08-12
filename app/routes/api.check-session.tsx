// Dev: check a shop's session
// GET /api/check-session?shop=shopigent-kosmos.myshopify.com
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
import prisma from "../lib/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const authHeader = request.headers.get("authorization");
  const key = authHeader?.slice(7);
  const hash = crypto.createHash("sha256").update(key || "").digest("hex");

  const authedShop = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!authedShop) {
    return json({ error: "Invalid API key" }, { status: 401 });
  }

  const url = new URL(request.url);
  const targetShop = url.searchParams.get("shop") || authedShop.shop;

  // Find sessions
  const sessions = await prisma.session.findMany({
    where: { shop: targetShop },
    select: { id: true, isOnline: true, accessToken: true, scope: true, expires: true },
  });

  return json({
    shop: targetShop,
    sessions: sessions.map((s: any) => ({
      id: s.id,
      isOnline: s.isOnline,
      hasToken: !!s.accessToken,
      tokenPrefix: s.accessToken ? s.accessToken.substring(0, 8) + "..." : null,
      scope: s.scope,
      expires: s.expires,
    })),
  });
};