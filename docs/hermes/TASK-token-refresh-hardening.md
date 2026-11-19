# TASK: Harden the expiring offline-token refresh (Shopigent Returns / shopigent-returns)

- **Lane:** `harden`. If you are on another lane, post `LANE CHANGE NEEDED: harden` and stop until Michalis switches.
- **Branch:** `task/token-refresh-hardening`, cut from `main` (verified at `4a955e4e`, 4 Sep 2026). One PR to `main`, **never merged by you**.
- **Order:** third repo (after Shopigent and AI GEO). Stop after opening the PR and wait for review.
- **Written:** 19 Nov 2026, against current `main` and current shopify.dev. Line numbers are from `4a955e4e`.

## 1. Context

Returns is public in code (`app/shopify.server.ts`), with `expiringOfflineAccessTokens: true` (`:39`). Per `package-lock.json` it uses `@shopify/shopify-app-remix` **4.2.1**, `@shopify/shopify-api` 13.1.0 and `shopify-app-session-storage-prisma` 9.0.1. The library refresh logic is byte-identical to 5.0.x (verified). The customer-facing return portal (`routes/return.tsx`), webhooks, the MCP handler and admin routes read the offline token straight from `Session` and call the Admin API with it. A hand-written refresh runs only after a 401.

## 2. Shopify rules this must follow (VERIFIED, shopify.dev, read 19 Nov 2026)

Sources:
- A: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens (Token refresh, How refresh token rotation works)
- B: https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange?lang=node (Refresh an expiring offline token)
- C: https://shopify.dev/docs/apps/build/authentication-authorization/migrate-to-expiring-offline-access-tokens
- D: https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps?lang=node

1. **Request.** `POST https://{shop}/admin/oauth/access_token` with `client_id`, `client_secret`, `grant_type=refresh_token` and `refresh_token`. The response has `access_token`, `scope`, `expires_in` (3600), `refresh_token` and `refresh_token_expires_in` (7776000). Store all of them, and read `expires_in` rather than hard-coding 1 h (A, D).
2. **Rotation.** Every refresh returns a new refresh token. The presented one stays usable until the app uses the newer one, until a token exchange or auth-code grant happens (which retires **every** other refresh token right away), 30 days after first use, or its 90-day expiry (A).
3. **Concurrency.** "Refresh one store at a time. Two workers refreshing the same store concurrently can leave one of them holding a token the other has already replaced" (B). And: "Don't do the two at the same time for the same store. Acquiring a token and refreshing one each retire the other's result" (A).
4. **Terminal error.** A dead refresh token returns `401 {"error":"invalid_request"}`, the same for every case. Treat it as final: stop retrying, clear the stored pair, and re-authenticate through token exchange the next time the merchant opens the app (B, C).
5. **Transient errors.** Network errors, timeouts, 5xx and 429 are safe to retry **with the same refresh_token** (B). Other 4xx are not retryable (D).

## 3. Library behaviour in this lockfile (VERIFIED from the npm tarball, remix 4.2.1, shopify-api 13.1.0)

- `unauthenticated.admin`, `authenticate.webhook`, flow and app proxy all call `ensureValidOfflineSession`. That calls `sessionStorage.loadSession("offline_<shop>")`, then refreshes if `session.isExpired(5 min)` and a `refreshToken` exists, then `storeSession` (`src/server/helpers/ensure-offline-token-is-not-expired.ts:8-31`). **There is no lock.** The file is identical in remix 4.2.1, 5.0.0 and 5.0.1.
- Embedded `authenticate.admin` (token-exchange strategy) does a **token exchange**, not a refresh, when the loaded session is missing or `!isActive(undefined, 5 min)` (`authenticate/admin/strategies/token-exchange.ts:54-67`). That retires every other refresh token (rule 2).
- The library refresh persists `expires`, `refreshToken` and `refreshTokenExpires` (`shopify-api/lib/auth/oauth/create-session.ts:50-57`). On any failure other than `400 invalid_subject_token`, it throws a 500 `Response` and clears nothing.
- Every library path reads through `config.sessionStorage.loadSession`. The offline id is `offline_<shop>` (`shopify-api/lib/session/session-utils.ts:24`).


## 4. Findings on current main (re-verified)

| # | Finding | Where | Status |
|---|---|---|---|
| R1 | `tryRefreshToken` writes `accessToken`, `refreshToken` and `expires`, but **not `refreshTokenExpires`**. The earlier audit said `expires` was missing too; it's written at `:110-112`. It also races the library (no lock). | `app/lib/shopify-admin.server.ts:60-122`, update at `:104-113` | VERIFIED, still open (partly corrected) |
| R2 | Refresh is reactive (401 only) in `shopifyAdminQuery` (`:37-54`) and `getOrdersByEmail` (`:130-140`). After the retry, `retryResp.json()` is returned without a status check. | as listed | VERIFIED |
| R3 | **About 25 direct token reads** from `prisma.session.findFirst(...)` with no expiry check. Many fall back to `findFirst({ where: { shop } })` with no `isOnline: false`: `routes/return.tsx:48, 362-364`, `routes/returns.$id.tsx:120-122, 187-188, 219-220, 283-284, 321-322, 346-347`, `routes/api.quick-action.tsx:75`, `routes/app.exchanges.tsx:81`, `routes/api.test-refund.tsx:19`, `routes/api.check-webhooks.tsx:18-19`, `lib/mcp-handler.server.ts:194, 557`, `lib/shopify-sync.server.ts:33-34`, `lib/returns-webhook.server.ts:5-6`, `routes/dev.seed-returns.tsx:57`. | `rg -n "prisma.session.find" app` | VERIFIED |
| R4 | A dead refresh token isn't cleared, so every later call repeats the refresh (retry storm). The failure log prints the full response body. | `shopify-admin.server.ts:96-99` | VERIFIED |
| R5 | `api.check-session` returns `tokenPrefix` (the first 8 characters of the access token). It also lets **any** valid MCP key read **any** shop's session metadata via `?shop=`, because `targetShop` isn't bound to `authedShop`. | `routes/api.check-session.tsx:18, 21-34` | VERIFIED, new (security) |

## 4b. Baseline on 19 Nov (VERIFIED by running it on `4a955e4e`)

- `npx tsc --noEmit` has **96 pre-existing errors** in 12 files (for example `returns.$id.tsx` 38, `return.tsx` 17). They are not yours to fix.
- `npm run build`: OK.
- `npm run lint` is **non-functional**: there's no ESLint config, so it reports "No files matching the pattern". Don't add a config in this PR.
- There's **no `test` script and no vitest** yet.

## 5. Target design

**Decision: one refresh module with a Postgres per-shop advisory lock, plus a wrapping `SessionStorage` so the library's own paths go through the same lock.**

Why not only `unauthenticated.admin(shop)`: the library refresh has no lock (section 3), so library-only still races between concurrent requests, jobs and overlapping deploy containers. On a dead refresh token it also re-tries on every call. Returns also has no `unauthenticated` export today, and its helpers take a raw token. The wrapper makes every library path see a fresh session, so the library never runs its own unlocked refresh or a token exchange while a valid refresh token exists. That satisfies both concurrency rules. Where code only needs an Admin client (not a raw token), using `unauthenticated.admin(shop)` on top of the wrapper is fine.

### 5.1 Module `app/lib/offline-token.server.ts`

```ts
export const OFFLINE_REFRESH_MARGIN_MS = 5 * 60 * 1000;               // >= library's 5 min
export const OFFLINE_REFRESH_LOCK_PREFIX = "shopify-offline-refresh:";
export class ReauthRequiredError extends Error {}   // dead or missing refresh token
export class TransientRefreshError extends Error {} // 429 / 5xx / network / timeout
export function needsRefresh(row: { expires: Date | null }, now = Date.now()): boolean
//   true iff row.expires && row.expires.getTime() - OFFLINE_REFRESH_MARGIN_MS <= now
export async function getFreshOfflineSession(shop: string, opts?: { rejectedAccessToken?: string }): Promise<SessionRow>
export async function getOfflineAccessToken(shop: string): Promise<string>
```

The algorithm in `getFreshOfflineSession`:

1. **Fast path, no lock.** Read the row by `id = "offline_<shop>"`. If `accessToken` is non-empty, `!needsRefresh(row)` and `accessToken !== opts.rejectedAccessToken`, return it.
2. **Locked path.** `prisma.$transaction(async (tx) => {...}, { maxWait: 10_000, timeout: 20_000 })`:
   1. `await tx.$queryRaw\`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${OFFLINE_REFRESH_LOCK_PREFIX + shop}))\``. ASSUMPTION: the void function in `FROM` avoids Prisma's void-deserialize error. Prove it with the optional integration test.
   2. **Re-read** the row. If someone already refreshed it, return it without HTTP.
   3. No row, or no `accessToken` and no `refreshToken`: throw `ReauthRequiredError`.
   4. `!refreshToken` or `refreshTokenExpires <= now`: clear the pair (see 401) and throw `ReauthRequiredError` without HTTP.
   5. POST the refresh (rule 1), with `AbortSignal.timeout(10_000)`.
      - **200** with `access_token`, `refresh_token` and `expires_in`: run `tx.session.updateMany({ where: { id, refreshToken: presented }, data: { accessToken, expires: now + expires_in*1000, refreshToken, refreshTokenExpires: now + refresh_token_expires_in*1000, scope: data.scope ?? row.scope } })`. That writes **all 4 fields in one statement**, guarded against stale writers. If `count !== 1`, throw. If `refresh_token` is missing, never null the stored one; treat it as failed.
      - **401**: set `{ accessToken: null, refreshToken: null, refreshTokenExpires: null, expires: null }` and throw `ReauthRequiredError`. The next embedded open token-exchanges a new pair, and later background calls fail fast without HTTP (no storm).
      - **429, 5xx, network or timeout**: leave the row untouched and throw `TransientRefreshError`. **No retry loop in the helper.**
      - **Other 4xx**: leave the row untouched and throw `Error("offline_refresh_failed status=<n>")`.
3. **Logging.** Log only `{ event, shop, status }`. Events: `offline_refresh_ok`, `offline_refresh_reauth_required`, `offline_refresh_transient`, `offline_refresh_failed`. **Never** log a token, a token prefix, the request body or the response body.

### 5.2 Wrap the session storage

`app/lib/locked-session-storage.server.ts` gets `class LockedRefreshSessionStorage implements SessionStorage` (the interface comes from `@shopify/shopify-app-session-storage`) that wraps `PrismaSessionStorage`:

- `loadSession(id)`: `s = await inner.loadSession(id)`. If `s && !s.isOnline && s.refreshToken && needsRefresh({ expires: s.expires ?? null })`:
  - Call `getFreshOfflineSession(s.shop)` and return `inner.loadSession(id)` again.
  - On `ReauthRequiredError`, return the reloaded (cleared) session.
  - On `TransientRefreshError`, return `s`.
- Everything else delegates unchanged.
- Wire it in `app/shopify.server.ts` (`sessionStorage: new LockedRefreshSessionStorage(new PrismaSessionStorage(prisma))`).
- Residual risk (state it in the PR): on a transient failure the library may try one unlocked refresh itself. Shopify makes a same-token retry safe (rule 5).


### 5.3 Changes in this repo

- Add `vitest` as a devDependency, `"test": "vitest run"` and `"typecheck": "npx prisma generate && npx tsc --noEmit"`, plus a minimal `vitest.config.ts` that resolves the `~/*` path.
- New `app/lib/offline-token.server.ts` (5.1) and `app/lib/locked-session-storage.server.ts` (5.2), wired at `app/shopify.server.ts:18`.
- `shopifyAdminQuery` and `getOrdersByEmail`: on a 401, call `getFreshOfflineSession(shop, { rejectedAccessToken: accessToken })` and retry **once**. Check the retry status the same way as the first call. **Delete `tryRefreshToken`.**
- Replace every R3 token read with `await getOfflineAccessToken(shop)` (proactive), and remove the `findFirst({ where: { shop } })` fallbacks. `useOnlineTokens` isn't set (VERIFIED: no match in `app/`), so all real sessions are offline. Keep each route's current user-facing error when `ReauthRequiredError` is thrown. In the public `return.tsx`, never expose details.
- R5: drop `tokenPrefix`, and only return sessions for `authedShop.shop` (ignore `?shop=`).
- Clearing value: `accessToken` is nullable (`prisma/schema.prisma:27`), so use `null`. No migration is needed: the columns exist (`:26-29`) and `@@unique([shop, isOnline])` is at `:40`. If you think you need one, stop and ask.

## 6. Tests to add (vitest, mocked `fetch` and Prisma)

- `needsRefresh`: null gives false; now+10 min gives false; now+5 min gives true (boundary); past gives true.
- Expiry math: with frozen time, `expires_in: 3600` and `refresh_token_expires_in: 7776000` give exact `expires` and `refreshTokenExpires`.
- Persistence: one `updateMany` writes all 4 fields with `where.refreshToken === presented`. If `refresh_token` is missing, nothing is nulled and the call throws.
- Concurrency: two parallel `getFreshOfflineSession` calls with an in-memory lock fake make **exactly one** refresh `fetch`, and both get the new token.
- 401 path at each Admin call site: Admin 401, then one refresh, then one retry. A second 401 surfaces with no further refresh. If `rejectedAccessToken` was already rotated by someone else, there's no HTTP.
- Dead refresh token (refresh endpoint 401): the pair is cleared, `ReauthRequiredError` is thrown, and a second call makes **no** HTTP.
- `refreshTokenExpires` in the past: no HTTP, `ReauthRequiredError`.
- Transient (503 and an AbortError): the row is untouched and `TransientRefreshError` is thrown.
- Log redaction: spy on `console.*` and assert no fake token string appears.
- `LockedRefreshSessionStorage.loadSession`: an expiring offline session is refreshed; online and non-expiring sessions are untouched.
- Optional integration test (only if `DATABASE_URL_TEST` is set, skip otherwise): two real transactions on the advisory lock serialize.

## 7. Acceptance checklist

- [ ] `rg -n "grant_type.*refresh_token|refresh_token:" app` hits only `offline-token.server.ts`. `tryRefreshToken` is gone.
- [ ] `rg -n "prisma.session.find" app` hits only the module, `locked-session-storage`, `api.check-session` (metadata, own shop) and `dev.debug-session` (no tokens).
- [ ] All 4 fields are persisted atomically, guarded on the presented refresh token. Refresh is proactive (5 min), and the 401 path retries at most once.
- [ ] A dead refresh token clears the pair with no repeated HTTP. Transient errors leave the row untouched.
- [ ] No token, prefix or response body appears in logs or responses (test, plus R5 fixed).
- [ ] The section 6 tests are added under `tests/`.
- [ ] Gates: `npx tsc --noEmit && npm run build && npm run lint && npm run test`.
  - **tsc**: no new errors. The count must be **96 or fewer**, and there must be zero errors in new files. Paste `npx tsc --noEmit | grep -c "error TS"` before and after into the PR.
  - **lint**: still non-functional (pre-existing, no config). Say so in the PR. Don't add a config here.
  - **build** and **test** must be green.
- [ ] The PR body has a "Verified" section: shopify.dev URLs, library files read, each R# with its fix, the tsc before/after counts, and the residual risk from 5.2.

## 8. Hard rules and out of scope

- Never merge, never deploy, no force-push, no Dev Dashboard, Partners or Railway changes, no writes to a live store or the production DB.
- Never log tokens or token prefixes.
- Out of scope: IP allowlists, the remix 4 to 5 upgrade, the 96 pre-existing tsc errors, setting up ESLint, and the REST `orders.json` call in `getOrdersByEmail`. Note each as a follow-up only. Don't touch `.github/workflows/`.
- When the PR is open (**not merged**), post its URL and the gate output, then **stop** for review.
