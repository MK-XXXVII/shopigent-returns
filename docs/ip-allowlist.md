# Shopify IP allowlist — Shopigent Returns

Shopify checks the source IP of every GraphQL Admin API and REST Admin API
request made with this app's tokens. Requests from outside the list, or
whose source Shopify cannot confirm, return HTTP 403.

## 18 Nov 2026 — enforced

Enforcement was turned **ON** on 18 Nov 2026 at 22:34 Europe/Amsterdam
(CET) in the Greek Nous org Dev Dashboard.

**Allowlist now in the Dev Dashboard:**

```
208.77.244.242/32
152.55.184.240/32
152.55.185.190/32
```

**Railway**

- Region: EU West (Amsterdam).
- One web service. Static outbound IPs (HA, three IPv4) were enabled on
  18 Nov 2026 around 21:10 Europe/Amsterdam (CET), then the service was
  redeployed. The three addresses above are that set.
- Admin API callers all run inside this web service: embedded admin
  routes, `shopifyAdminQuery` / refunds / sync, and the in-process MCP
  handler (`app/routes/api.mcp.ts`). There is no separate worker or
  cron service, and the repo has no GitHub Actions workflow that calls
  the merchant Admin API.

Shopify's Run test after the list was entered reported that only an older
Railway address, `152.55.185.45`, would have been blocked. That address
is pre-static-IP egress and is expected to appear in the 30-day window.

Manual diagnostic scripts in `scripts/` (`check-webhooks.mjs`,
`test-orders-by-email.mjs`) call the Admin API from whatever machine
runs them. They are not covered by this list unless that machine's
egress is added. Do not run them against a live shop from a laptop
while enforcement is on.

## Rollback

Dev Dashboard → Shopigent Returns → Settings → IP allowlist → turn
**Enforce IP allowlist** OFF → **Save**. The list is kept.

## When Railway IPs change

Static IPs can change if the service changes region, and Railway may
reassign the HA set. Before removing anything:

1. Read the new addresses in Railway → service → Settings → Networking.
2. Add the new `/32`s to the Dev Dashboard list. Do not remove the old
   entries yet.
3. **Run test**. Confirm the new addresses would be allowed and that
   current traffic is not left off the list.
4. **Save** (keep Enforcement ON).
5. Confirm from Dev Dashboard → Logs (and any egress probe, if one is
   added later) that live Admin calls come from the new addresses.
6. Only then remove addresses that are no longer in use, Run test, Save.

If a new Railway service is added that itself calls the Admin API, it
needs its own static IPs and those `/32`s must be added before it is
allowed to use the app's tokens.
