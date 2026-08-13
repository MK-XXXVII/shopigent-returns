#!/usr/bin/env bash
# Security regression tests for Shopigent Returns
set -uo pipefail

MCP_KEY=$(cat /root/.secrets/returns_mcp_key.txt)
MCP_URL="https://returns.greeknous.com/api/mcp"
PASS=0
FAIL=0

test_case() {
  local name="$1"
  local result="$2"
  local expected="$3"
  if echo "$result" | grep -q "$expected"; then
    echo "  ✅ PASS: $name"
    ((PASS++))
  else
    echo "  ❌ FAIL: $name (expected '$expected')"
    echo "     Got: $(echo "$result" | head -c 200)"
    ((FAIL++))
  fi
}

echo ""
echo "═══════════════════════════════════════════"
echo "  SECURITY REGRESSION TESTS"
echo "═══════════════════════════════════════════"

# 1. Replay same token
echo ""
echo "--- Test 1: Token replay ---"
# Issue a token for a fake return
TOKEN=$(curl -s -X POST $MCP_URL -H "Authorization: Bearer $MCP_KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"issue_confirmation_token","arguments":{"action":"approve_return","returnId":"fake-replay-test","args":{"returnId":"fake-replay-test"}}}}}' \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('result',{}).get('content',[{}])[0].get('text',''))" 2>/dev/null \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('confirmationToken','NONE'))" 2>/dev/null)
echo "  Token issued: ${TOKEN:0:30}..."
test_case "Token issued" "$TOKEN" "eyJ"

# Try approving with same token (should fail - return not found)
RESULT=$(curl -s -X POST $MCP_URL -H "Authorization: Bearer $MCP_KEY" -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"approve_return\",\"arguments\":{\"returnId\":\"fake-replay-test\",\"confirmationToken\":\"$TOKEN\"}}}" 2>/dev/null)
test_case "Token replay on fake return" "$RESULT" "Return not found"

echo ""
echo "--- Test 2: Approve already APPROVED return ---"
# Find an APPROVED return
APPROVED=$(curl -s -X POST $MCP_URL -H "Authorization: Bearer $MCP_KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_returns","arguments":{"status":"APPROVED","limit":1}}}' 2>/dev/null \
  | python3 -c "import json,sys;d=json.load(sys.stdin);c=d.get('result',{}).get('content',[{}])[0];t=json.loads(c.get('text','{}'));r=t.get('returns',[]);print(r[0]['id'] if r else 'NONE')" 2>/dev/null)

if [ "$APPROVED" != "NONE" ]; then
  echo "  Found APPROVED return: $APPROVED"
  TOKEN2=$(curl -s -X POST $MCP_URL -H "Authorization: Bearer $MCP_KEY" -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"issue_confirmation_token\",\"arguments\":{\"action\":\"approve_return\",\"returnId\":\"$APPROVED\",\"args\":{\"returnId\":\"$APPROVED\"}}}}" 2>/dev/null \
    | python3 -c "import json,sys;d=json.load(sys.stdin);c=d.get('result',{}).get('content',[{}])[0];t=json.loads(c.get('text','{}'));print(t.get('confirmationToken','NONE'))" 2>/dev/null)
  RESULT2=$(curl -s -X POST $MCP_URL -H "Authorization: Bearer $MCP_KEY" -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"approve_return\",\"arguments\":{\"returnId\":\"$APPROVED\",\"confirmationToken\":\"$TOKEN2\"}}}" 2>/dev/null)
  test_case "Double-approve blocked" "$RESULT2" "already APPROVED"
else
  echo "  ⚠️ No APPROVED returns to test"
fi

echo ""
echo "--- Test 3: Deny already DENIED return ---"
DENIED=$(curl -s -X POST $MCP_URL -H "Authorization: Bearer $MCP_KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"list_returns","arguments":{"status":"DENIED","limit":1}}}' 2>/dev/null \
  | python3 -c "import json,sys;d=json.load(sys.stdin);c=d.get('result',{}).get('content',[{}])[0];t=json.loads(c.get('text','{}'));r=t.get('returns',[]);print(r[0]['id'] if r else 'NONE')" 2>/dev/null)

if [ "$DENIED" != "NONE" ]; then
  TOKEN3=$(curl -s -X POST $MCP_URL -H "Authorization: Bearer $MCP_KEY" -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"tools/call\",\"params\":{\"name\":\"issue_confirmation_token\",\"arguments\":{\"action\":\"deny_return\",\"returnId\":\"$DENIED\",\"args\":{\"returnId\":\"$DENIED\",\"reason\":\"test\"}}}}" 2>/dev/null \
    | python3 -c "import json,sys;d=json.load(sys.stdin);c=d.get('result',{}).get('content',[{}])[0];t=json.loads(c.get('text','{}'));print(t.get('confirmationToken','NONE'))" 2>/dev/null)
  RESULT3=$(curl -s -X POST $MCP_URL -H "Authorization: Bearer $MCP_KEY" -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":8,\"method\":\"tools/call\",\"params\":{\"name\":\"deny_return\",\"arguments\":{\"returnId\":\"$DENIED\",\"reason\":\"test\",\"confirmationToken\":\"$TOKEN3\"}}}" 2>/dev/null)
  test_case "Double-deny blocked" "$RESULT3" "already DENIED"
else
  echo "  ⚠️ No DENIED returns to test"
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════════"
exit $FAIL