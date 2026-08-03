import prisma from "./db.server";
import { executeRefund } from "./shopify-admin.server";
import { sendEmail, returnApprovedEmail, returnDeniedEmail, refundProcessedEmail } from "./email.server";
import { createReturnLabel } from "./label-provider.server";
import { RETURNS_TOOLS } from "./mcp-types";

function jsonRpcError(id: string | number, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function jsonRpcResult(id: string | number, result: any) {
  return { jsonrpc: "2.0", id, result };
}

export async function handleMcpRequest(body: any) {
  const { method, id, params } = body;

  switch (method) {
    // === Lifecycle ===
    case "initialize":
      return jsonRpcResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "shopigent-returns", version: "0.1.0" },
      });

    case "tools/list":
      return jsonRpcResult(id, { tools: RETURNS_TOOLS });

    // === Tool implementations ===

    case "tools/call": {
      const toolName = params?.name;
      const args = params?.arguments || {};

      switch (toolName) {
        case "analyze_return": {
          const returnReq = await prisma.returnRequest.findUnique({
            where: { id: args.returnId },
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");

          const policies = await prisma.policy.findMany({
            where: { shop: returnReq.shop, isActive: true },
            orderBy: { priority: "asc" },
          });

          const items = returnReq.items as any[];
          const totalAmount = items.reduce((sum: number, i: any) => sum + (parseFloat(i.price || "0") * (i.quantity || 0)), 0);
          const daysSinceOrder = returnReq.createdAt
            ? Math.floor((Date.now() - new Date(returnReq.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          // Evaluate policies
          let bestPolicy: any = null;
          for (const policy of policies) {
            const conditions = policy.conditions as any[];
            const matches = conditions.every((c: any) => {
              if (c.field === "maxDays") return daysSinceOrder <= c.value;
              if (c.field === "maxAmount") return totalAmount <= c.value;
              return true;
            });
            if (matches) { bestPolicy = policy; break; }
          }

          const autoApprove = bestPolicy?.conditions?.find((c: any) => c.field === "autoApprove")?.value;
          const restockingFee = bestPolicy?.conditions?.find((c: any) => c.field === "restockingFee")?.value || 0;
          const maxDays = bestPolicy?.conditions?.find((c: any) => c.field === "maxDays")?.value || 30;
          const maxAmount = bestPolicy?.conditions?.find((c: any) => c.field === "maxAmount")?.value || 9999;

          let recommendation: string;
          let confidence: number;

          if (bestPolicy && autoApprove) {
            recommendation = "approve";
            confidence = 0.9;
          } else if (bestPolicy) {
            recommendation = "review";
            confidence = 0.6;
          } else {
            recommendation = "review";
            confidence = 0.3;
          }

          return jsonRpcResult(id, {
            returnId: returnReq.id,
            orderName: returnReq.orderName,
            customerName: returnReq.customerName,
            totalAmount,
            daysSinceOrder,
            policyMatch: bestPolicy ? {
              name: bestPolicy.name,
              maxDays,
              maxAmount,
              autoApprove: !!autoApprove,
              restockingFee: restockingFee,
            } : null,
            recommendation,
            confidence,
            reasoning: bestPolicy
              ? `Order matches "${bestPolicy.name}": ${daysSinceOrder} days (≤${maxDays}), $${totalAmount} (≤$${maxAmount})${autoApprove ? ", auto-approve enabled" : ""}`
              : "No matching policy found. Manual review required.",
          });
        }

        case "approve_return": {
          const returnReq = await prisma.returnRequest.findUnique({
            where: { id: args.returnId },
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");

          // Calculate refund amount
          const items = returnReq.items as any[];
          const totalAmount = args.refundAmount || items.reduce(
            (sum: number, i: any) => sum + (parseFloat(i.price || "0") * (i.quantity || 0)), 0
          );

          // Get the store's offline access token
          const session = await prisma.session.findFirst({
            where: { shop: returnReq.shop, isOnline: false },
          });

          let refundResult = null;
          if (session?.accessToken) {
            try {
              const orderIdNum = returnReq.orderId.replace("gid://shopify/Order/", "");
              refundResult = await executeRefund(
                returnReq.shop,
                session.accessToken,
                orderIdNum,
                totalAmount,
                true,
                args.notes || "Auto-approved by Shopigent Returns AI agent"
              );
            } catch (err: any) {
              refundResult = { error: err.message };
            }
          }

          // Generate return label if requested
          let labelResult = null;
          if (args.issueLabel) {
            labelResult = await createReturnLabel({
              orderName: returnReq.orderName || returnReq.id,
              customerName: returnReq.customerName || "Customer",
              customerEmail: returnReq.customerEmail || "",
              items: items,
              weight: 1,
              description: returnReq.reason || "Customer return",
              shopAddress: {
                line1: process.env.SHOP_ADDRESS_LINE1 || "",
                city: process.env.SHOP_ADDRESS_CITY || "",
                postalCode: process.env.SHOP_ADDRESS_ZIP || "",
                country: process.env.SHOP_ADDRESS_COUNTRY || "NL",
              },
            });
          }

          const updated = await prisma.returnRequest.update({
            where: { id: args.returnId },
            data: {
              status: refundResult?.id ? "REFUNDED" : "APPROVED",
              decidedBy: "agent",
              decidedAt: new Date(),
              notes: args.notes || null,
              refundAmount: totalAmount,
              refundId: refundResult?.id || null,
              labels: labelResult?.success
                ? [{ type: "return_label", status: "ready", url: labelResult.labelUrl, tracking: labelResult.trackingNumber }]
                : args.issueLabel
                  ? [{ type: "return_label", status: "failed", error: labelResult?.error }]
                  : undefined,
            },
          });

          await prisma.decisionLog.create({
            data: {
              returnId: args.returnId,
              actor: "agent",
              action: refundResult?.id ? "refund" : "approve",
              details: {
                refundAmount: totalAmount,
                refundTransactionId: refundResult?.id || null,
                refundError: refundResult?.error || null,
                issueLabel: args.issueLabel,
                notes: args.notes,
              },
            },
          });

          // Send email notification
          if (returnReq.customerEmail) {
            const emailData = refundResult?.id
              ? refundProcessedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", totalAmount)
              : returnApprovedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", totalAmount);
            sendEmail({ ...emailData, to: returnReq.customerEmail });
          }

          return jsonRpcResult(id, {
            success: true,
            status: updated.status,
            returnId: updated.id,
            refundExecuted: !!refundResult?.id,
            refundId: refundResult?.id || null,
            refundError: refundResult?.error || null,
          });
        }

        case "deny_return": {
          const returnReq = await prisma.returnRequest.findUnique({
            where: { id: args.returnId },
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");

          const updated = await prisma.returnRequest.update({
            where: { id: args.returnId },
            data: {
              status: "DENIED",
              decidedBy: "agent",
              decidedAt: new Date(),
              notes: args.reason,
            },
          });

          await prisma.decisionLog.create({
            data: {
              returnId: args.returnId,
              actor: "agent",
              action: "deny",
              details: { reason: args.reason },
            },
          });

          // Send email notification
          if (returnReq.customerEmail) {
            sendEmail({ ...returnDeniedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", args.reason), to: returnReq.customerEmail });
          }

          return jsonRpcResult(id, { success: true, status: "DENIED", returnId: updated.id });
        }

        case "check_fraud": {
          const returnReq = await prisma.returnRequest.findUnique({
            where: { id: args.returnId },
            include: { fraudSignals: true },
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");

          // Basic fraud checks
          const items = returnReq.items as any[];
          const totalAmount = items.reduce((sum: number, i: any) => sum + (parseFloat(i.price || "0") * (i.quantity || 0)), 0);

          const signals: any[] = [];

          // Check amount anomaly
          if (totalAmount > 1000) {
            signals.push({ signal: "high_value_return", score: 0.3, details: { amount: totalAmount } });
          }

          // Check recent returns by same customer
          if (returnReq.customerEmail) {
            const recentCount = await prisma.returnRequest.count({
              where: {
                customerEmail: returnReq.customerEmail,
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
              },
            });
            if (recentCount > 2) {
              signals.push({ signal: "frequent_returner", score: 0.5, details: { returnsIn30Days: recentCount } });
            }
          }

          // Save signals
          for (const s of signals) {
            await prisma.fraudSignal.create({
              data: {
                returnId: args.returnId,
                signal: s.signal,
                score: s.score,
                details: s.details,
              },
            });
          }

          const maxScore = signals.length > 0 ? Math.max(...signals.map((s: any) => s.score)) : 0;

          return jsonRpcResult(id, {
            returnId: args.returnId,
            riskLevel: maxScore > 0.5 ? "high" : maxScore > 0.2 ? "medium" : "low",
            riskScore: maxScore,
            signals,
          });
        }

        case "list_policies": {
          const policies = await prisma.policy.findMany({
            where: { isActive: true },
            orderBy: { priority: "asc" },
          });
          return jsonRpcResult(id, {
            policies: policies.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              priority: p.priority,
              conditions: p.conditions,
            })),
          });
        }

        case "get_policy_recommendation": {
          const returnReq = await prisma.returnRequest.findUnique({
            where: { id: args.returnId },
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");

          const items = returnReq.items as any[];
          const totalAmount = items.reduce((sum: number, i: any) => sum + (parseFloat(i.price || "0") * (i.quantity || 0)), 0);
          const daysSinceOrder = Math.floor((Date.now() - new Date(returnReq.createdAt).getTime()) / (1000 * 60 * 60 * 24));

          const policies = await prisma.policy.findMany({
            where: { shop: returnReq.shop, isActive: true },
            orderBy: { priority: "asc" },
          });

          let bestMatch: any = null;
          for (const policy of policies) {
            const conditions = policy.conditions as any[];
            const matches = conditions.every((c: any) => {
              if (c.field === "maxDays") return daysSinceOrder <= c.value;
              if (c.field === "maxAmount") return totalAmount <= c.value;
              return true;
            });
            if (matches) { bestMatch = policy; break; }
          }

          return jsonRpcResult(id, {
            totalAmount,
            daysSinceOrder,
            bestMatch: bestMatch ? {
              name: bestMatch.name,
              conditions: bestMatch.conditions,
            } : null,
          });
        }

        case "list_returns": {
          const where: any = {};
          if (args.status) where.status = args.status;
          const returns = await prisma.returnRequest.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: args.limit || 10,
          });
          return jsonRpcResult(id, {
            returns: returns.map((r) => ({
              id: r.id,
              orderName: r.orderName,
              customerName: r.customerName,
              status: r.status,
              totalItems: (r.items as any[]).length,
              createdAt: r.createdAt,
            })),
          });
        }

        default:
          return jsonRpcError(id, -32601, `Unknown tool: ${toolName}`);
      }
    }

    default:
      return jsonRpcError(id, -32601, `Unknown method: ${method}`);
  }
}