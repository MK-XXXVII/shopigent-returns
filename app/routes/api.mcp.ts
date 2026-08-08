import { json, type ActionFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
import { handleMcpRequest } from "../lib/mcp-handler.server";
import { checkRateLimit } from "../lib/rate-limit.server";
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

  const shop = await prisma.shop.findUnique({
    where: { mcpApiKeyHash: hash },
  });

  if (!shop) {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Invalid API key" } },
      { status: 401 }
    );
  }

  // Check if shop is still installed
  if (shop.uninstalledAt) {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Shop has uninstalled the app" } },
      { status: 403 }
    );
  }

  const body = await request.json();

  if (body.jsonrpc !== "2.0" || !body.method) {
    return json(
      { jsonrpc: "2.0", id: body.id || null, error: { code: -32600, message: "Invalid Request" } },
      { status: 400 }
    );
  }

  // Rate limiting (skip for initialize and tool list)
  const method = body.method;
  if (method !== "initialize" && !method.startsWith("notifications/")) {
    const rateCheck = await checkRateLimit(shop.shop);
    if (!rateCheck.allowed) {
      return json(
        {
          jsonrpc: "2.0",
          id: body.id || null,
          error: {
            code: -32029,
            message: `Rate limit exceeded. Retry after ${rateCheck.retryAfterSeconds}s`,
          },
        },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds) } }
      );
    }
  }

  // Handle the request with shop context
  const response = await handleMcpRequest(body, shop.shop);

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
      "issue_confirmation_token",
      "list_policies",
      "get_policy_recommendation",
      "list_returns",
    ],
  });
};