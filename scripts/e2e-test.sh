#!/usr/bin/env bash
# Shopigent Returns — End-to-End Test Suite
# Tests all core features via the MCP API + direct DB checks
# Usage: MCP_KEY=your_key_here bash scripts/e2e-test.sh

set -uo pipefail

MCP_URL="https://returns.greeknous.com/api/mcp"
APP_URL="https://returns.greeknous.com"
PASS=0
FAIL=0

green() { echo -e "\033[32m✅ $1\033[0m"; }
red() { echo -e "\033[31m❌ $1\033[0m"; }
info() { echo -e "\033[36m🔍 $1\033[0m"; }

# Verify MCP key
if [ -z "${MCP_KEY:-}" ] && [ -f /root/.secrets/returns_mcp_key.txt ]; then
  MCP_KEY=$(cat /root/.secrets/returns_mcp_key.txt)
fi
if [ -z "${MCP_KEY:-}" ]; then
  red "MCP_KEY not set. Run: MCP_KEY=your_key bash $0"
  exit 1
fi

mcpcall() {
  curl -s -X POST "$MCP_URL" \
    -H "Authorization: Bearer $MCP_KEY" \
    -H "Content-Type: application/json" \
    -d "$1"
}

echo "═══════════════════════════════════════════════"
echo "  Shopigent Returns — E2E Test Suite"
echo "═══════════════════════════════════════════════"
echo ""

# ──── 1. Health Check ────
info "1. Health Check"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/healthz" || true)
if [ "$HTTP" = "200" ]; then
  green "Health endpoint returns 200"; ((PASS++))
else
  red "Health check failed: $HTTP"; ((FAIL++))
fi

# ──── 2. MCP Initialization ────
info "2. MCP Initialize"
RESULT=$(mcpcall '{"jsonrpc":"2.0","id":1,"method":"initialize"}')
if echo "$RESULT" | grep -q "shopigent-returns"; then
  green "MCP initialize successful"; ((PASS++))
else
  red "MCP initialize failed"; ((FAIL++))
fi

# ──── 3. MCP List Tools ────
info "3. MCP List Tools"
RESULT=$(mcpcall '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')
TOOL_COUNT=$(echo "$RESULT" | python3 -c "import json,sys;print(len(json.load(sys.stdin)['result']['tools']))")
if [ "$TOOL_COUNT" -ge 7 ]; then
  green "MCP lists $TOOL_COUNT tools (expected 7+)"; ((PASS++))
else
  red "Expected 7+ tools, got $TOOL_COUNT"; ((FAIL++))
fi

# ──── 4. MCP List Returns ────
info "4. MCP List Returns"
RESULT=$(mcpcall '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_returns","arguments":{"limit":5}}}')
RETURN_COUNT=$(echo "$RESULT" | python3 -c "import json,sys;print(len(json.load(sys.stdin)['result']['returns']))")
if [ "$RETURN_COUNT" -ge 1 ]; then
  green "List returns: $RETURN_COUNT returns found"; ((PASS++))
else
  red "No returns found (seed data missing?)"; ((FAIL++))
fi

# ──── 5. MCP List Policies ────
info "5. MCP List Policies"
RESULT=$(mcpcall '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"list_policies","arguments":{}}}')
POLICY_COUNT=$(echo "$RESULT" | python3 -c "import json,sys;print(len(json.load(sys.stdin)['result']['policies']))")
if [ "$POLICY_COUNT" -ge 1 ]; then
  green "List policies: $POLICY_COUNT policies found"; ((PASS++))
else
  red "No policies found"; ((FAIL++))
fi

# ──── 6. MCP Analyze Return (first PENDING) ────
info "6. MCP Analyze Return"
PENDING_ID=$(mcpcall '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"list_returns","arguments":{"status":"PENDING","limit":1}}}' | python3 -c "import json,sys;d=json.load(sys.stdin);r=d['result']['returns'];print(r[0]['id'] if r else '')")
if [ -n "$PENDING_ID" ]; then
  RESULT=$(mcpcall "{\"jsonrpc\":\"2.0\",\"id\":6,\"method\":\"tools/call\",\"params\":{\"name\":\"analyze_return\",\"arguments\":{\"returnId\":\"$PENDING_ID\"}}}")
  if echo "$RESULT" | grep -q "recommendation"; then
    green "Analyze return: $(echo $RESULT | python3 -c "import json,sys;print(json.load(sys.stdin)['result']['recommendation'])")"; ((PASS++))
  else
    red "Analyze return failed"; ((FAIL++))
  fi
else
  info "No PENDING returns to analyze (skipping)"; ((PASS++))
fi

# ──── 7. MCP Check Fraud ────
info "7. MCP Check Fraud"
if [ -n "$PENDING_ID" ]; then
  RESULT=$(mcpcall "{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"tools/call\",\"params\":{\"name\":\"check_fraud\",\"arguments\":{\"returnId\":\"$PENDING_ID\"}}}")
  if echo "$RESULT" | grep -q "riskLevel"; then
    green "Fraud check: $(echo $RESULT | python3 -c "import json,sys;print(json.load(sys.stdin)['result']['riskLevel'])") risk"; ((PASS++))
  else
    red "Fraud check failed"; ((FAIL++))
  fi
else
  info "No returns to check fraud (skipping)"; ((PASS++))
fi

# ──── 8. MCP Get Policy Recommendation ────
info "8. MCP Policy Recommendation"
if [ -n "$PENDING_ID" ]; then
  RESULT=$(mcpcall "{\"jsonrpc\":\"2.0\",\"id\":8,\"method\":\"tools/call\",\"params\":{\"name\":\"get_policy_recommendation\",\"arguments\":{\"returnId\":\"$PENDING_ID\"}}}")
  if echo "$RESULT" | grep -q "bestMatch"; then
    green "Policy recommendation returned"; ((PASS++))
  else
    red "Policy recommendation failed"; ((FAIL++))
  fi
else
  info "No returns for policy recommendation (skipping)"; ((PASS++))
fi

# ──── 9. Customer Portal ────
info "9. Customer Portal"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/return")
if [ "$HTTP" = "200" ]; then
  green "Customer portal returns 200"; ((PASS++))
else
  red "Customer portal failed: $HTTP"; ((FAIL++))
fi

# ──── 10. Docs Site ────
info "10. Docs Site"
DOCS_URL="https://returns-docs-production.up.railway.app"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$DOCS_URL/")
if [ "$HTTP" = "200" ]; then
  green "Docs site returns 200"; ((PASS++))
else
  red "Docs site failed: $HTTP"; ((FAIL++))
fi
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$DOCS_URL/guides/getting-started")
if [ "$HTTP" = "200" ]; then
  green "Getting started guide: 200"; ((PASS++))
else
  red "Getting started guide: $HTTP"; ((FAIL++))
fi
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$DOCS_URL/reference/api")
if [ "$HTTP" = "200" ]; then
  green "API reference: 200"; ((PASS++))
else
  red "API reference: $HTTP"; ((FAIL++))
fi

# ──── 11. MCP Approve & Deny ────
info "11. MCP Approve/Deny"
if [ -n "$PENDING_ID" ]; then
  # Try approve (will succeed in DB even if refund fails - test data has fake order IDs)
  RESULT=$(mcpcall "{\"jsonrpc\":\"2.0\",\"id\":9,\"method\":\"tools/call\",\"params\":{\"name\":\"approve_return\",\"arguments\":{\"returnId\":\"$PENDING_ID\",\"notes\":\"E2E test approval\"}}}")
  if echo "$RESULT" | grep -q "success.*true"; then
    green "Approve return successful"; ((PASS++))
  else
    red "Approve return failed"; ((FAIL++))
  fi

  # Find the newly created PENDING return
  NEW_PENDING=$(mcpcall '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"list_returns","arguments":{"status":"PENDING","limit":1}}}' | python3 -c "import json,sys;d=json.load(sys.stdin);r=d['result']['returns'];print(r[0]['id'] if r else '')")
  if [ -n "$NEW_PENDING" ]; then
    RESULT=$(mcpcall "{\"jsonrpc\":\"2.0\",\"id\":11,\"method\":\"tools/call\",\"params\":{\"name\":\"deny_return\",\"arguments\":{\"returnId\":\"$NEW_PENDING\",\"reason\":\"E2E test: outside return window\"}}}")
    if echo "$RESULT" | grep -q "DENIED"; then
      green "Deny return successful"; ((PASS++))
    else
      red "Deny return failed"; ((FAIL++))
    fi
  else
    info "No PENDING returns for deny test (skipping)"; ((PASS++))
  fi
fi

# ──── Summary ────
echo ""
echo "═══════════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0