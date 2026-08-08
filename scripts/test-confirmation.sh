#!/usr/bin/env bash
# Test confirmation gate
set -uo pipefail

MCP_KEY=$(cat /root/.secrets/returns_mcp_key.txt)
MCP_URL="https://returns.greeknous.com/api/mcp"

echo "=== 1. Test: List tools (should have 8 now) ==="
RESULT=$(curl -s -X POST $MCP_URL -H "Authorization: Bearer $MCP_KEY" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')
echo "$RESULT" | python3 -c "import json,sys;d=json.load(sys.stdin);print(f'{len(d[\"result\"][\"tools\"])} tools')"

echo ""
echo "=== 2. Test: Approve without confirmation (should fail) ==="
RESULT=$(curl -s -X POST $MCP_URL -H "Authorization: Bearer $MCP_KEY" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"approve_return","arguments":{"returnId":"test-123","confirmationToken":""}}}')
echo "$RESULT" | python3 -c "import json,sys;d=json.load(sys.stdin);err=d.get('error',{});print(f'Result: {err.get(\"message\",d.get(\"result\",\"?\"))}')"

echo ""
echo "=== 3. Test: Issue confirmation token ==="
RESULT=$(curl -s -X POST $MCP_URL -H "Authorization: Bearer $MCP_KEY" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"issue_confirmation_token","arguments":{"action":"approve_return","returnId":"test-123","args":{"returnId":"test-123"}}}}')
TOKEN=$(echo "$RESULT" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('result',{}).get('confirmationToken','NO_TOKEN'))")
echo "Token issued: ${TOKEN:0:30}..."
echo "$RESULT" | python3 -c "import json,sys;d=json.load(sys.stdin);print(f'expires: {d.get(\"result\",{}).get(\"expiresInMs\",\"?\")}ms')"

echo ""
echo "Done!"