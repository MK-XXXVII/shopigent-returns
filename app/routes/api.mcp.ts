import { json, type ActionFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
import { handleMcpRequest } from "../lib/mcp-handler.server";
import prisma from "../lib/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // Auth: verify MCP API key via Authorization header
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const key = authHeader.slice(7);
  const hash = crypto.createHash("sha256").update(key).digest("hex");

  const shop = await prisma.shop.findFirst({
    where: { mcpApiKeyHash: hash },
  });

  if (!shop) {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Invalid API key" } },
      { status: 401 }
    );
  }

  const body = await request.json();

  if (body.jsonrpc !== "2.0" || !body.method) {
    return json(
      { jsonrpc: "2.0", id: body.id || null, error: { code: -32600, message: "Invalid Request" } },
      { status: 400 }
    );
  }

  // Handle the request
  const response = await handleMcpRequest(body);

  return json(response);
};

// GET returns info about the MCP server
export const loader = async () => {
  return json({
    name: "shopigent-returns-mcp",
    version: "0.1.0",
    protocol: "2024-11-05",
    description: "MCP server for Shopigent Returns — AI-agentic return management for Shopify.",
    tools: [
      "analyze_return",
      "approve_return",
      "deny_return",
      "check_fraud",
      "list_policies",
      "get_policy_recommendation",
      "list_returns",
    ],
  });
};