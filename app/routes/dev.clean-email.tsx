// DEV ONLY — clean return data for a specific email (preserves policies)
// Used to remove stale return records that block new submissions.
import { json, type ActionFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
import prisma from "../lib/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // Auth: verify MCP key hash (same as api.mcp.ts)
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, { status: 401 });
  const key = authHeader.slice(7);
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const shop = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!shop) return json({ error: "Invalid key" }, { status: 401 });

  const url = new URL(request.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();

  if (!email) {
    return json({ error: "Provide ?email= param" }, { status: 400 });
  }

  // Find all return requests for this email, collect their IDs
  const returns = await prisma.returnRequest.findMany({
    where: { shop: shop.shop, customerEmail: email },
    select: { id: true, orderName: true, status: true },
  });
  const returnIds = returns.map((r) => r.id);

  // Cascade-delete related records first, then the returns themselves
  const logsDeleted = await prisma.decisionLog.deleteMany({ where: { returnId: { in: returnIds } } });
  const signalsDeleted = await prisma.fraudSignal.deleteMany({ where: { returnId: { in: returnIds } } });
  const returnsDeleted = await prisma.returnRequest.deleteMany({ where: { id: { in: returnIds } } });

  return json({
    ok: true,
    email,
    returnsFound: returns.length,
    returns: returns,
    deleted: { returns: returnsDeleted.count, logs: logsDeleted.count, signals: signalsDeleted.count },
  });
};