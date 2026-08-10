import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
import prisma from "../lib/db.server";

// DEV ONLY: Upgrade a shop to Pro plan
// POST /api/upgrade-pro?shop=shopigent-kosmos.myshopify.com
// with Authorization: Bearer <returns_mcp_key>
export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Send POST to upgrade" });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const authHeader = request.headers.get("authorization");
  const key = authHeader?.slice(7);
  const hash = crypto.createHash("sha256").update(key || "").digest("hex");

  const authedShop = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!authedShop) {
    return json({ error: "Invalid API key" }, { status: 401 });
  }

  // Allow upgrading a specific shop by query param
  const url = new URL(request.url);
  const targetShop = url.searchParams.get("shop") || authedShop.shop;

  await prisma.shop.upsert({
    where: { shop: targetShop },
    update: { planName: "pro" },
    create: { id: targetShop, shop: targetShop, planName: "pro" },
  });

  return json({ ok: true, shop: targetShop, plan: "pro", upgradedBy: authedShop.shop });
};