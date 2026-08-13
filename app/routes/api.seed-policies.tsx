import { json, type ActionFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
import prisma from "../lib/db.server";

// DEV ONLY: Seed 3 example policies for screenshots
export const action = async ({ request }: ActionFunctionArgs) => {
  const authHeader = request.headers.get("authorization");
  const key = authHeader?.slice(7);
  const hash = crypto.createHash("sha256").update(key || "").digest("hex");

  const shop = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!shop) return json({ error: "Invalid API key" }, { status: 401 });

  // Allow targeting a specific shop by query param
  const url = new URL(request.url);
  const targetShop = url.searchParams.get("shop") || shop.shop;

  const policies = [
    { name: "Standard 30-Day Return", description: "Auto-approved for items under $200. 0% restocking fee.", priority: 1, isActive: true, conditions: [{ field: "maxDays", operator: "lte", value: 30 }, { field: "maxAmount", operator: "lte", value: 200 }, { field: "autoApprove", operator: "eq", value: true }, { field: "restockingFee", operator: "eq", value: 0 }] },
    { name: "High-Value Review", description: "Items over $200 flagged for manual review. 10% restocking fee.", priority: 2, isActive: true, conditions: [{ field: "maxDays", operator: "lte", value: 30 }, { field: "minAmount", operator: "gt", value: 200 }, { field: "autoApprove", operator: "eq", value: false }, { field: "restockingFee", operator: "eq", value: 10 }] },
    { name: "Final Sale - Electronics", description: "Electronics, clearance, and custom items are non-returnable.", priority: 3, isActive: true, conditions: [{ field: "maxDays", operator: "lte", value: 0 }, { field: "autoApprove", operator: "eq", value: false }, { field: "restockingFee", operator: "eq", value: 0 }] },
  ];

  let created = 0, updated = 0;
  for (const p of policies) {
    const existing = await prisma.policy.findFirst({ where: { shop: targetShop, name: p.name } });
    const data = { name: p.name, description: p.description, priority: p.priority, isActive: p.isActive, conditions: p.conditions, shop: targetShop };
    if (existing) {
      await prisma.policy.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.policy.create({ data });
      created++;
    }
  }

  return json({ ok: true, shop: targetShop, created, updated });
};