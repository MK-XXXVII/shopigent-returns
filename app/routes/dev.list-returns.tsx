// DEV ONLY — list all returns in the DB (to debug duplicate-check false positives)
import { json } from "@remix-run/node";
import * as crypto from "node:crypto";
import prisma from "../lib/db.server";

export const loader = async ({ request }: any) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, { status: 401 });
  const key = authHeader.slice(7);
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const shop = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!shop) return json({ error: "Invalid key" }, { status: 401 });

  const returns = await prisma.returnRequest.findMany({
    where: { shop: shop.shop },
    select: { id: true, orderId: true, orderName: true, customerEmail: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return json({ count: returns.length, returns });
};