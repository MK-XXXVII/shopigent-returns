import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
import prisma from "../lib/db.server";

// DEV ONLY: Upgrade a shop to Pro plan
export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Send POST to upgrade" });
};
// POST /api/upgrade-pro with Authorization: Bearer <returns_mcp_key>
export const action = async ({ request }: ActionFunctionArgs) => {
  const authHeader = request.headers.get("authorization");
  const key = authHeader?.slice(7);
  const hash = crypto.createHash("sha256").update(key || "").digest("hex");

  const shop = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!shop) {
    return json({ error: "Invalid API key" }, { status: 401 });
  }

  await prisma.shop.update({
    where: { id: shop.id },
    data: { planName: "pro" },
  });

  return json({ ok: true, shop: shop.shop, plan: "pro" });
};