// DEV ONLY — debug: list sessions + shops for this store
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;
  const sessions = await prisma.session.findMany({ where: { shop } });
  const shopRec = await prisma.shop.findUnique({ where: { shop } });
  return json({
    shop,
    currentSessionId: session.id,
    onlineScope: session.scope,
    storedSessions: sessions.map((s) => ({ id: s.id, isOnline: s.isOnline, hasAccess: !!s.accessToken, hasRefresh: !!s.refreshToken })),
    hasShopRecord: !!shopRec,
    shopPlan: shopRec?.planName,
  });
};