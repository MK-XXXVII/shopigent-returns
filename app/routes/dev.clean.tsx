// Dev: clean all return data (protected by MCP key)
import { json, type ActionFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
import prisma from "../lib/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const authHeader = request.headers.get("authorization");
  const body = await request.json().catch(() => ({}));
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, { status: 401 });
  const key = authHeader.slice(7);
  const expectedHash = crypto.createHash("sha256").update(key).digest("hex");
  const storedHash = process.env.MCP_KEY_HASH;
  if (expectedHash !== storedHash) return json({ error: "Invalid key" }, { status: 401 });

  await prisma.fraudSignal.deleteMany({});
  await prisma.decisionLog.deleteMany({});
  await prisma.returnRequest.deleteMany({});
  await prisma.policy.deleteMany({});
  return json({ ok: true, cleaned: "FraudSignal, DecisionLog, ReturnRequest, Policy" });
};