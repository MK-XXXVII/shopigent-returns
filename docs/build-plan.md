# Shopigent Returns — Build Plan

## Tech Stack
- **Runtime:** Node 20+ (Railway)
- **Framework:** Express/Fastify API + Remix SPA embedded app (Polaris)
- **Database:** Postgres + Prisma ORM
- **Auth:** Shopify OAuth (offline tokens, expiring)
- **Deploy:** Railway (project `shopigent-returns`)
- **AI interface:** MCP server (StreamableHTTP)

## Data Model (Prisma)

```
ReturnRequest
  id            String @id @default(uuid())
  shop          String (shopDomain)
  orderId       String (Shopify Order GID)
  customerEmail String
  customerName  String
  items         Json[] (line items being returned: variantId, title, qty, reason)
  reason        String
  status        ReturnStatus (PENDING, APPROVED, DENIED, EXCHANGE, SHIPPED, REFUNDED, CLOSED)
  aiDecision    Json? (agent's reasoning)
  aiConfidence  Float?
  decidedBy     String? (agent | merchant)
  decidedAt     DateTime?
  labels        Json[] (RMA labels generated)
  refundAmount  Decimal?
  refundId      String? (Shopify refund transaction ID)
  notes         String?
  createdAt     DateTime
  updatedAt     DateTime

Policy
  id            String @id @default(uuid())
  shop          String
  name          String
  isActive      Boolean @default(true)
  conditions    Json (rules: maxDays, condition, restockingFee, autoApprove)
  priority      Int @default(0)
  createdAt     DateTime

FraudSignal
  id            String @id @default(uuid())
  returnId      String (FK to ReturnRequest)
  signal        String (ip_geolocation_mismatch, history_velocity, zip_mismatch, etc.)
  score         Float
  details       Json
  createdAt     DateTime

DecisionLog (audit trail)
  id            String @id @default(uuid())
  returnId      String
  actor         String (agent | merchant | system)
  action        String (approve, deny, request_info, refund, generate_label)
  details       Json
  createdAt     DateTime

enum ReturnStatus: PENDING | APPROVED | DENIED | EXCHANGE | SHIPPED | REFUNDED | CLOSED
```

## API Routes (Express/Fastify)

### Embedded App UI (Remix SPA)
- `/` — Dashboard (analytics summary)
- `/returns` — List all returns (filterable by status, date)
- `/returns/:id` — Return detail (timeline, actions)
- `/returns/:id/actions` — Override/approve/deny
- `/policies` — Policy management UI
- `/settings` — App settings (email templates, etc.)
- `/api/*` — Backend API

### Backend API (Express/Fastify)
- `POST /api/webhooks/orders/fulfilled` — Fulfillment webhook (auto-return window)
- `POST /api/webhooks/app/uninstalled` — Cleanup
- `GET /api/returns` — List returns (with filters)
- `GET /api/returns/:id` — Return detail
- `POST /api/returns/:id/approve` — Merchant override
- `POST /api/returns/:id/deny`
- `POST /api/returns/:id/exchange`
- `POST /api/returns/:id/refund` — Execute Shopify refund
- `GET /api/policies` — List policies
- `POST /api/policies` — Create/update policy
- `GET /api/analytics` — Return rate, $ saved, fraud caught

### MCP Server (for agent)
- `tools/list` — `analyze_return`, `approve_return`, `deny_return`, `issue_label`, `process_refund`, `check_fraud`, `get_policy_recommendation`
- `tools/call` — Execute

## Build Order

### Phase 1: Foundation
1. `package.json` + Express/Fastify server boilerplate
2. Prisma schema + initial migration
3. Shopify OAuth flow (offline token, session storage)
4. Railway deploy → verify app loads

### Phase 2: Policy Engine
5. Policy CRUD (API + DB)
6. Policy evaluation (match order → conditions → decision)

### Phase 3: Return Intake
7. Customer portal embed (initiate return + upload photos)
8. Return creation webhook (from Shopify order fulfillment)

### Phase 4: AI Pipeline
9. MCP server scaffolding
10. `analyze_return` tool (agent reviews reason, items, policy, fraud signals)
11. `check_fraud` tool (IP, velocity, patterns)
12. Decision automation

### Phase 5: Actions
13. Label generation (carrier API)
14. Shopify refund execution (Admin API)
15. Exchange workflow

### Phase 6: Merchant Dashboard
16. Returns list + detail views (Polaris)
17. Analytics charts
18. Override actions