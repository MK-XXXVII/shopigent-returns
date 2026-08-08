// Rate limiting for MCP API calls
// Postgres-backed, per-minute + per-day buckets per shop

import prisma from "./db.server";

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_CALLS_PER_MINUTE = 60;
const MAX_CALLS_PER_DAY = 1000;

export async function checkRateLimit(shop: string): Promise<{
  allowed: boolean;
  retryAfterSeconds?: number;
  remaining: number;
}> {
  const now = Date.now();
  const minuteWindow = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  // Get shop config for custom limits
  const shopRec = await prisma.shop.findUnique({ where: { shop } });
  const config: any = shopRec?.config || {};
  const maxPerMinute = config.rateLimitPerMinute || MAX_CALLS_PER_MINUTE;
  const maxPerDay = config.rateLimitPerDay || MAX_CALLS_PER_DAY;

  // Count calls in current minute window
  const minuteCalls = await prisma.decisionLog.count({
    where: {
      actor: "agent",
      createdAt: { gte: new Date(minuteWindow) },
      return: { shop },
    },
  });

  if (minuteCalls >= maxPerMinute) {
    const retryAfter = Math.ceil((minuteWindow + WINDOW_MS - now) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: retryAfter,
      remaining: 0,
    };
  }

  // Count calls today
  const todayCalls = await prisma.decisionLog.count({
    where: {
      actor: "agent",
      createdAt: { gte: dayStart },
      return: { shop },
    },
  });

  if (todayCalls >= maxPerDay) {
    const tomorrow = new Date(dayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const retryAfter = Math.ceil((tomorrow.getTime() - now) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: retryAfter,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: Math.min(
      maxPerMinute - minuteCalls,
      maxPerDay - todayCalls
    ),
  };
}