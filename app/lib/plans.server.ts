import prisma from "./db.server";

// Plan-based access control for MCP tools
// Free: read-only (analyze, list, check)
// Growth+: full access (approve, deny, refund)
// Pro+: all features

export type PlanTier = "free" | "growth" | "pro" | null;

export function getPlanTier(planName: string | null | undefined): PlanTier {
  switch (planName) {
    case "growth": return "growth";
    case "pro": return "pro";
    default: return "free";
  }
}

// Tools that require at least Growth plan
const GROWTH_TOOLS = new Set([
  "approve_return",
  "deny_return",
  "issue_confirmation_token",
]);

// Tools that require Pro plan
const PRO_TOOLS = new Set([
  "exchange_return",
]);

export function isToolAllowed(toolName: string, planTier: PlanTier): { allowed: boolean; requiredPlan?: string } {
  if (PRO_TOOLS.has(toolName) && planTier !== "pro") {
    return { allowed: false, requiredPlan: "pro" };
  }
  if (GROWTH_TOOLS.has(toolName) && planTier !== "growth" && planTier !== "pro") {
    return { allowed: false, requiredPlan: "growth" };
  }
  return { allowed: true };
}

export async function checkPlanLimit(shop: string, planTier: PlanTier): Promise<{ allowed: boolean; message?: string }> {
  if (planTier !== "free") {
    return { allowed: true }; // Growth and Pro have no limits
  }

  // Free plan: limit to 10 returns/month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyCount = await prisma.returnRequest.count({
    where: {
      shop,
      createdAt: { gte: startOfMonth },
    },
  });

  const FREE_LIMIT = 10;
  if (monthlyCount >= FREE_LIMIT) {
    return {
      allowed: false,
      message: `Free plan limit reached (${FREE_LIMIT} returns/month). Upgrade to Growth for unlimited returns.`,
    };
  }

  return { allowed: true };
}