// MCP Protocol types for Shopigent Returns
export interface McpRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface McpResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export const RETURNS_TOOLS: McpTool[] = [
  {
    name: "analyze_return",
    description: "Analyze a return request against store policies and fraud signals. Returns a recommendation (approve/deny/exchange) with confidence score.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" },
      },
      required: ["returnId"],
    },
  },
  {
    name: "approve_return",
    description: "Approve a pending return request. Optionally set refund amount and issue a return label.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" },
        refundAmount: { type: "number", description: "Optional override refund amount" },
        issueLabel: { type: "boolean", description: "Whether to generate a return label" },
        notes: { type: "string", description: "Notes about the decision" },
      },
      required: ["returnId"],
    },
  },
  {
    name: "deny_return",
    description: "Deny a pending return request with a reason.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" },
        reason: { type: "string", description: "Reason for denial" },
      },
      required: ["returnId", "reason"],
    },
  },
  {
    name: "check_fraud",
    description: "Run fraud detection signals on a return request. Checks IP velocity, history patterns, amount anomalies.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" },
      },
      required: ["returnId"],
    },
  },
  {
    name: "list_policies",
    description: "List all active return policies for the store.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_policy_recommendation",
    description: "Get a policy-based recommendation for a return request. Evaluates against all active policies and returns the best match.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" },
      },
      required: ["returnId"],
    },
  },
  {
    name: "list_returns",
    description: "List return requests, optionally filtered by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: PENDING, APPROVED, DENIED, EXCHANGE, SHIPPED, REFUNDED, CLOSED" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
    },
  },
];