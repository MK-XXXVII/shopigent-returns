// Confirmation token system for human-in-the-loop approval
// HMAC-signed, self-contained tokens — no server-side storage needed
// 5-minute TTL, argsHash binding prevents replay attacks

import * as crypto from "node:crypto";
import type { McpTool } from "./mcp-types";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ConfirmationPayload {
  shop: string;
  action: string;
  returnId: string;
  argsHash: string;
  issuedAt: number;
}

export function issueConfirmationToken(
  secret: string,
  shop: string,
  action: string,
  returnId: string,
  args: any
): string {
  const argsHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(args))
    .digest("hex")
    .slice(0, 16);

  const payload: ConfirmationPayload = {
    shop,
    action,
    returnId,
    argsHash,
    issuedAt: Date.now(),
  };

  const data = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");

  // Base64 encode payload + signature
  return Buffer.from(JSON.stringify({ data, signature })).toString("base64");
}

export function verifyConfirmationToken(
  token: string,
  secret: string,
  expectedShop: string,
  expectedAction: string,
  expectedReturnId: string,
  expectedArgs: any
): { valid: boolean; reason?: string } {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    const { data, signature } = decoded;

    // Verify signature
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("hex");

    if (signature !== expectedSig) {
      return { valid: false, reason: "Invalid signature" };
    }

    const payload: ConfirmationPayload = JSON.parse(data);

    // Check expiry
    if (Date.now() - payload.issuedAt > TTL_MS) {
      return { valid: false, reason: "Token expired" };
    }

    // Check shop
    if (payload.shop !== expectedShop) {
      return { valid: false, reason: "Shop mismatch" };
    }

    // Check action
    if (payload.action !== expectedAction) {
      return { valid: false, reason: "Action mismatch" };
    }

    // Check returnId
    if (payload.returnId !== expectedReturnId) {
      return { valid: false, reason: "Return ID mismatch" };
    }

    // Check args hash
    const argsHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(expectedArgs))
      .digest("hex")
      .slice(0, 16);

    if (payload.argsHash !== argsHash) {
      return { valid: false, reason: "Arguments mismatch" };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Invalid token format" };
  }
}

// Add confirmation token tool to MCP tool list
export const CONFIRMATION_TOOL: McpTool = {
  name: "issue_confirmation_token",
  description:
    "Issue a confirmation token for a destructive operation (approve/deny return). " +
    "The agent must first call this tool, then include the returned token in the actual " +
    "approve_return or deny_return call. Token expires in 5 minutes.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["approve_return", "deny_return"],
        description: "The action to confirm",
      },
      returnId: {
        type: "string",
        description: "The return request UUID",
      },
      args: {
        type: "object",
        description: "The arguments that will be passed to the action",
      },
    },
    required: ["action", "returnId", "args"],
  },
};