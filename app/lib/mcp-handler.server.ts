import prisma from "./db.server";
import { executeRefund, createStoreCredit, shopifyAdminQuery } from "./shopify-admin.server";
import { sendEmail, returnApprovedEmail, returnDeniedEmail, refundProcessedEmail, storeCreditProcessedEmail } from "./email.server";
import { createReturnLabel } from "./label-provider.server";
import { issueConfirmationToken, verifyConfirmationToken } from "./confirmation.server";
import { getPlanTier, isToolAllowed, checkPlanLimit } from "./plans.server";
import { RETURNS_TOOLS } from "./mcp-types";
import { loadFraudRules, evaluateFraudRules, type FraudRulesConfig } from "./fraud-rules.server";

function jsonRpcError(id: string | number, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function jsonRpcResult(id: string | number, result: any) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcToolResult(id: string | number, data: any) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } };
}

export async function handleMcpRequest(body: any, shop?: string) {
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

      // Plan-based access control
      if (shop) {
        const shopRec = await prisma.shop.findUnique({ where: { shop } });
        const planTier = getPlanTier(shopRec?.planName);
        const { allowed, requiredPlan } = isToolAllowed(toolName, planTier);
        if (!allowed) {
          return jsonRpcError(id, -32001, `Upgrade to ${requiredPlan?.toUpperCase()} plan to use this tool.`);
        }
      }

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

          return jsonRpcToolResult(id, {
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

        case "issue_confirmation_token": {
          const secret = process.env.CONFIRMATION_TOKEN_SECRET;
          if (!secret) return jsonRpcError(id, -32602, "Confirmation token secret not configured");

          const token = issueConfirmationToken(
            secret,
            args.shop || "shop",
            args.action,
            args.returnId,
            args.args || {}
          );

          return jsonRpcToolResult(id, {
            confirmationToken: token,
            expiresInMs: 5 * 60 * 1000,
            message: "Include this token as `confirmationToken` in your approve_return or deny_return call.",
          });
        }

        case "approve_return": {
          // Atomic state transition: claim the return atomically
          // Only proceeds if status is still PENDING — prevents double-approve
          const claim = await prisma.returnRequest.updateMany({
            where: { id: args.returnId, status: "PENDING" },
            data: {
              status: "APPROVED",
              decidedBy: "agent",
              decidedAt: new Date(),
              notes: args.notes || null,
            },
          });

          if (claim.count === 0) {
            const existing = await prisma.returnRequest.findUnique({ where: { id: args.returnId } });
            if (!existing) return jsonRpcError(id, -32602, "Return not found");
            return jsonRpcError(id, -32000, `Return is already ${existing.status}. Only PENDING returns can be approved.`);
          }

          // Verify confirmation token
          const secret = process.env.CONFIRMATION_TOKEN_SECRET;
          const returnReq = await prisma.returnRequest.findUnique({
            where: { id: args.returnId },
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");
          if (secret) {
            const check = verifyConfirmationToken(
              args.confirmationToken || "",
              secret,
              returnReq.shop,
              "approve_return",
              args.returnId,
              args
            );
            if (!check.valid) {
              return jsonRpcError(id, -32000, `Confirmation required: ${check.reason}. Call issue_confirmation_token first.`);
            }
          }

          // Calculate refund amount — optionally filter by returnedItems
          const allItems = returnReq.items as any[];
          const items = args.returnedItems
            ? allItems.filter((i: any) =>
                args.returnedItems.includes(i.id) || args.returnedItems.includes(i.variantId)
              )
            : allItems;
          const totalAmount = args.refundAmount || items.reduce(
            (sum: number, i: any) => sum + (parseFloat(i.price || "0") * (i.quantity || 0)), 0
          );

          // Get the store's offline access token
          const session = await prisma.session.findFirst({
            where: { shop: returnReq.shop, isOnline: false },
          });

          let refundResult = null;
          let storeCreditResult = null;
          if (session?.accessToken) {
            try {
              // Look up the actual order in Shopify
              const orderName = returnReq.orderName || returnReq.orderId;
              const orderQuery = `{ orders(first: 1, query: "name:${orderName}") { edges { node { id totalPriceSet { shopMoney { amount } } } } } }`;
              const orderResult = await shopifyAdminQuery(returnReq.shop, session.accessToken, orderQuery);
              const realOrder = orderResult?.data?.orders?.edges?.[0]?.node;
              const realTotal = realOrder ? parseFloat(realOrder.totalPriceSet?.shopMoney?.amount || "0") : 0;
              const orderGid = realOrder?.id || returnReq.orderId;

              // Use real order total if no manual items with prices
              const effectiveAmount = args.refundAmount || (items.length > 0 && parseFloat(items[0]?.price || "0") > 0
                ? totalAmount
                : realTotal > 0 ? realTotal : totalAmount);

              if (args.storeCredit) {
                // Issue store credit discount code instead of refund
                storeCreditResult = await createStoreCredit(
                  returnReq.shop,
                  session.accessToken,
                  effectiveAmount,
                  returnReq.customerEmail || "",
                  args.notes || "Return store credit"
                );
              } else {
                refundResult = await executeRefund(
                  returnReq.shop,
                  session.accessToken,
                  orderGid,
                  effectiveAmount,
                  true,
                  args.notes || "Auto-approved by Shopigent Returns AI agent"
                );
              }
            } catch (err: any) {
              if (args.storeCredit) {
                storeCreditResult = { error: err.message };
              } else {
                refundResult = { error: err.message };
              }
            }
          }

          // Generate return label if requested
          let labelResult = null;
          if (args.issueLabel) {
            labelResult = await createReturnLabel(returnReq.shop, {
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
              status: (refundResult?.id || storeCreditResult?.discountCode) ? "REFUNDED" : "APPROVED",
              decidedBy: "agent",
              decidedAt: new Date(),
              notes: args.notes || null,
              refundAmount: totalAmount,
              refundId: refundResult?.id || storeCreditResult?.discountId || null,
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
              action: args.storeCredit ? "store_credit" : (refundResult?.id ? "refund" : "approve"),
              details: {
                refundAmount: totalAmount,
                refundTransactionId: refundResult?.id || null,
                storeCreditCode: storeCreditResult?.discountCode || null,
                storeCreditDiscountId: storeCreditResult?.discountId || null,
                refundError: refundResult?.error || storeCreditResult?.error || null,
                returnedItems: args.returnedItems || null,
                issueLabel: args.issueLabel,
                notes: args.notes,
              },
            },
          });

          // Send email notification
          if (returnReq.customerEmail) {
            let emailData;
            if (storeCreditResult?.discountCode) {
              emailData = storeCreditProcessedEmail(
                returnReq.customerName || "Customer",
                returnReq.orderName || "",
                totalAmount,
                storeCreditResult.discountCode
              );
            } else if (refundResult?.id) {
              emailData = refundProcessedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", totalAmount);
            } else {
              emailData = returnApprovedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", totalAmount);
            }
            sendEmail({ ...emailData, to: returnReq.customerEmail });
          }

          return jsonRpcToolResult(id, {
            success: true,
            status: updated.status,
            returnId: updated.id,
            refundExecuted: !!refundResult?.id,
            refundId: refundResult?.id || null,
            refundError: refundResult?.error || null,
            storeCreditExecuted: !!storeCreditResult?.discountCode,
            storeCreditCode: storeCreditResult?.discountCode || null,
            storeCreditError: storeCreditResult?.error || null,
          });
        }

        case "deny_return": {
          const returnReq = await prisma.returnRequest.findUnique({
            where: { id: args.returnId },
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");

          // Prevent double-processing
          if (returnReq.status !== "PENDING") {
            return jsonRpcError(id, -32000, `Return is already ${returnReq.status}. Only PENDING returns can be denied.`);
          }

          // Verify confirmation token
          const secret = process.env.CONFIRMATION_TOKEN_SECRET;
          if (secret) {
            const check = verifyConfirmationToken(
              args.confirmationToken || "",
              secret,
              returnReq.shop,
              "deny_return",
              args.returnId,
              args
            );
            if (!check.valid) {
              return jsonRpcError(id, -32000, `Confirmation required: ${check.reason}. Call issue_confirmation_token first.`);
            }
          }

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

          return jsonRpcToolResult(id, { success: true, status: "DENIED", returnId: updated.id });
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
          let recentCount = 0;
          if (returnReq.customerEmail) {
            recentCount = await prisma.returnRequest.count({
              where: {
                customerEmail: returnReq.customerEmail,
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
              },
            });
            if (recentCount > 2) {
              signals.push({ signal: "frequent_returner", score: 0.5, details: { returnsIn30Days: recentCount } });
            }
          }

          // ── Custom merchant-configured fraud rules ──────────
          // Load the shop record for fraud rules config
          const shopRec = await prisma.shop.findUnique({
            where: { shop: returnReq.shop },
          });
          const customRules: FraudRulesConfig = loadFraudRules(shopRec?.config as Record<string, any> || {});

          // Re-count within the merchant-configured window if different from hardcoded 30-day
          const windowMs = customRules.maxReturnsWindowDays * 24 * 60 * 60 * 1000;
          const windowedCount = returnReq.customerEmail && customRules.maxReturnsWindowDays !== 30
            ? await prisma.returnRequest.count({
                where: {
                  customerEmail: returnReq.customerEmail,
                  createdAt: { gte: new Date(Date.now() - windowMs) },
                },
              })
            : recentCount;

          const customResult = evaluateFraudRules(
            {
              totalAmount,
              customerEmail: returnReq.customerEmail,
              customerCountry: args.customerCountry || null,
            },
            customRules,
            windowedCount
          );

          // Merge custom rule results into signals
          for (const rule of customResult.triggeredRules) {
            signals.push({
              signal: rule.rule,
              score: rule.score,
              details: { description: rule.details },
            });
          }
          // ── end custom rules ────────────────────────────────

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

          return jsonRpcToolResult(id, {
            returnId: args.returnId,
            riskLevel: maxScore > 0.5 ? "high" : maxScore > 0.2 ? "medium" : "low",
            riskScore: maxScore,
            signals,
            customRulesApplied: customRules.enabled,
          });
        }

        case "list_policies": {
          const policies = await prisma.policy.findMany({
            where: { isActive: true },
            orderBy: { priority: "asc" },
          });
          return jsonRpcToolResult(id, {
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

          return jsonRpcToolResult(id, {
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
          return jsonRpcToolResult(id, {
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

        case "exchange_return": {
          const returnReq = await prisma.returnRequest.findUnique({
            where: { id: args.returnId },
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");
          if (returnReq.status !== "PENDING" && returnReq.status !== "EXCHANGE") {
            return jsonRpcError(id, -32602, `Cannot exchange return in status ${returnReq.status}. Only PENDING or EXCHANGE status allowed.`);
          }

          // Get the store's offline access token
          const session = await prisma.session.findFirst({
            where: { shop: returnReq.shop, isOnline: false },
          });
          if (!session?.accessToken) {
            return jsonRpcError(id, -32000, "No Shopify access token available for this store");
          }

          const replacementVariantId = args.replacementVariantId;
          const replacementQuantity = args.replacementQuantity || 1;
          const notes = args.notes || null;

          // Create draft order for the replacement item (100% discount = free exchange)
          const draftResult = await createDraftOrder(
            returnReq.shop,
            session.accessToken,
            [{ variantId: replacementVariantId, quantity: replacementQuantity }],
            returnReq.customerEmail || undefined,
            `Exchange for return ${returnReq.id}${notes ? ` - ${notes}` : ""}`
          );

          if (draftResult.error || !draftResult.draftOrderId) {
            return jsonRpcError(id, -32000, `Failed to create exchange order: ${draftResult.error}`);
          }

          // Mark the return as EXCHANGE and store the replacement order info
          const updated = await prisma.returnRequest.update({
            where: { id: args.returnId },
            data: {
              status: "EXCHANGE",
              decidedBy: "agent",
              decidedAt: new Date(),
              notes: notes,
              labels: [
                {
                  type: "exchange_order",
                  status: "created",
                  draftOrderId: draftResult.draftOrderId,
                  replacementVariantId,
                  replacementQuantity,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          });

          await prisma.decisionLog.create({
            data: {
              returnId: args.returnId,
              actor: "agent",
              action: "exchange",
              details: {
                draftOrderId: draftResult.draftOrderId,
                replacementVariantId,
                replacementQuantity,
                notes,
              },
            },
          });

          return jsonRpcToolResult(id, {
            success: true,
            status: "EXCHANGE",
            returnId: updated.id,
            draftOrderId: draftResult.draftOrderId,
            message: "Exchange order created. The replacement item draft order has been created at no charge.",
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