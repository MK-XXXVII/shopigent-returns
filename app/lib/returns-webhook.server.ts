// Ensure the returns/update webhook is registered for a shop (via REST API)
import prisma from "./db.server";

export async function ensureReturnsWebhook(shop: string): Promise<{ ok: boolean; detail?: string }> {
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = sess?.accessToken || (await prisma.session.findFirst({ where: { shop } }))?.accessToken;
  if (!token) return { ok: false, detail: "No access token" };

  const base = `https://${shop}/admin/api/2026-10`;
  const callback = `${process.env.SHOPIFY_APP_URL || "https://returns.greeknous.com"}/api/webhooks`;

  // 1. Check existing
  const listRes = await fetch(`${base}/webhooks.json?topic=returns/update`, {
    headers: { "X-Shopify-Access-Token": token },
  });
  const list = await listRes.json();
  const existing = (list?.webhooks || []).find((h: any) => h.address === callback);
  if (existing) {
    return { ok: true, detail: `Already registered (id ${existing.id})` };
  }

  // 2. Create it
  const createRes = await fetch(`${base}/webhooks.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({
      webhook: {
        topic: "returns/update",
        address: callback,
        format: "json",
        api_version: "2026-10",
      },
    }),
  });
  const created = await createRes.json();
  if (created?.webhook?.id) {
    return { ok: true, detail: `Registered (id ${created.webhook.id})` };
  }
  return { ok: false, detail: `Create failed: ${JSON.stringify(created.errors || created).slice(0, 300)}` };
}
