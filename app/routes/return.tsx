import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { Card, BlockStack, Text, TextField, Button, Banner, Checkbox, InlineStack } from "@shopify/polaris";
import { useState } from "react";
import prisma from "../lib/db.server";
import { sendEmail, storeCreditProcessedEmail } from "../lib/email.server";
import { shouldBypassOtp, generateDevOtp } from "../lib/otp-dev.server";
import { shopifyAdminQuery } from "../lib/shopify-admin.server";

// Customer Portal — public-facing, no Shopify auth required
// Uses the store's stored offline access token to query the Admin API
// OTP verification: email → send code → verify → show orders

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";
  return json({ shop });
};

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const _action = formData.get("_action") as string;
  const shop = formData.get("shop") as string || "";
  const email = (formData.get("email") as string || "").trim().toLowerCase();

  if (!shop) {
    return json({ error: "Missing store information. Please use the link provided by the store." });
  }

  if (!email) {
    return json({ error: "Email is required." });
  }

  // Get the store's offline session
  const session = await prisma.session.findFirst({
    where: { shop, isOnline: false },
  });

  if (!session?.accessToken) {
    return json({ error: "Store is not connected. Please try again later." }, { status: 400 });
  }

  // ─── Step 1: Request OTP ───────────────────────────────────
  if (_action === "request_otp") {
    // No customer lookup needed — send OTP directly
    // Order lookup happens after OTP verification
    // (GraphQL customers query requires protected customer data approval)

    // Generate and store OTP code
    const code = shouldBypassOtp(email) ? generateDevOtp() : generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate any previous unused codes for this shop+email
    await prisma.otpCode.updateMany({
      where: { shop, email, used: false },
      data: { used: true },
    });

    await prisma.otpCode.create({
      data: { shop, email, code, expiresAt },
    });

    // Send OTP via email
    const sent = await sendEmail({
      to: email,
      subject: `Your verification code — Shopigent Returns`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px">
        <h2 style="color:#7C3AED">Shopigent Returns</h2>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center;padding:16px;background:#f3f0ff;border-radius:8px;margin:16px 0;color:#7C3AED">${code}</div>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
      </div>`,
    });

    if (!sent && !shouldBypassOtp(email)) {
      return json({ error: "Failed to send verification email. Please try again." });
    }

    // Dev bypass: return the OTP code so the tester can use it
    if (shouldBypassOtp(email)) {
      return json({ otpSent: true, email, devOtp: code, devMessage: "DEV MODE: Use this code to verify" });
    }

    return json({ otpSent: true, email });
  }

  // ─── Step 2: Verify OTP ────────────────────────────────────
  if (_action === "verify_otp") {
    const code = (formData.get("code") as string || "").trim();

    if (!code || code.length !== 6) {
      return json({ error: "Please enter the 6-digit code sent to your email." });
    }

    const otp = await prisma.otpCode.findFirst({
      where: { shop, email, code, used: false, expiresAt: { gte: new Date() } },
    });

    if (!otp) {
      return json({ error: "Invalid or expired code. Please request a new one." });
    }

    // Mark as used
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    });

    // ─── Now OTP verified — ask for order number ──────────────
    // Instead of looking up orders by email (requires protected customer data approval),
    // we ask the customer for their order number and look it up by name
    return json({
      verified: true,
      customer: { name: email.split("@")[0] },
      email,
      needsOrderNumber: true,
      message: "Please enter your order number to start the return.",
    });
  }

  // ─── Step 3: Look up order by number (reference only) ─────
  if (_action === "lookup_order") {
    const orderName = (formData.get("orderName") as string || "").trim();

    if (!orderName) {
      return json({ error: "Please enter your order number." });
    }

    // Format the order name (e.g., "1001" → "#1001")
    const formatted = orderName.startsWith("#") ? orderName : `#${orderName}`;

    // Don't query Shopify API (protected customer data).
    // Accept the order number for reference; customer will enter items manually.
    // The MCP agent will validate the order when processing the return.

    // Create a mock order with the order name so the UI can show the item entry form
    const mockOrder = {
      id: orderName,
      name: formatted,
      createdAt: new Date().toISOString(),
      total: "0",
      currency: "USD",
      fulfilled: false,
      items: [], // customer will add items manually
    };

    return json({
      verified: true,
      customer: { name: email.split("@")[0] },
      orders: [mockOrder],
      email,
      manualEntry: true, // flag to show manual item entry form
      message: `Order ${formatted} noted. Now add the items you want to return.`,
    });
  }

  // ─── Submit Return ─────────────────────────────────────────
  if (_action === "submit_return") {
    const orderId = formData.get("orderId") as string;
    const customerName = formData.get("customerName") as string;
    const customerEmail = formData.get("customerEmail") as string;
    const reason = formData.get("reason") as string;
    const orderName2 = formData.get("orderName2") as string;

    // Items can be provided as JSON or entered manually
    let selectedItems: any[] = [];
    const itemsJson = formData.get("selectedItems") as string;
    const manualItemNames = formData.get("manualItemNames") as string;

    if (itemsJson) {
      try { selectedItems = JSON.parse(itemsJson); } catch {}
    }

    // If no items from JSON, parse manual input (comma-separated item names)
    if (selectedItems.length === 0 && manualItemNames) {
      selectedItems = manualItemNames.split(",").map((s, i) => ({
        id: `manual-${i}`,
        title: s.trim(),
        quantity: 1,
        price: "0",
      }));
    }

    if (!orderId || selectedItems.length === 0) {
      return json({ error: "Please enter at least one item to return." });
    }

    await prisma.returnRequest.create({
      data: {
        shop,
        orderId,
        orderName: orderName2,
        customerEmail,
        customerName,
        items: selectedItems,
        reason,
        status: "PENDING",
      },
    });

    return json({ success: true, message: "Return request submitted! We'll review it shortly." });
  }

  return json({ error: "Invalid action" });
};

export default function ReturnPortal() {
  const { shop } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [manualItems, setManualItems] = useState<{ name: string; qty: string; price: string }[]>([]);

  const data = fetcher.data;
  const isSubmitting = fetcher.state === "submitting";

  // Determine current step
  const otpSent = data?.otpSent === true;
  const verified = data?.verified === true;
  const success = data?.success === true;
  const error = data?.error;
  const orders = data?.orders || [];
  const customer = data?.customer;

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  if (success) {
    return (
      <div style={{ maxWidth: 600, margin: "40px auto", padding: 20 }}>
        <Card>
          <BlockStack gap="400" align="center">
            <Text variant="headingXl" as="h1" alignment="center" tone="success">
              ✅ Return Submitted!
            </Text>
            <Text variant="bodyMd" as="p" alignment="center">
              {data.message}
            </Text>
            <Button onClick={() => window.location.reload()}>Submit Another Return</Button>
          </BlockStack>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 20 }}>
      <Card>
        <BlockStack gap="400">
          <Text variant="headingXl" as="h1" fontWeight="bold">
            Start a Return
          </Text>
          <Text variant="bodyMd" as="p" tone="subdued">
            {!otpSent && !verified && "Enter your email to receive a verification code."}
            {otpSent && !verified && "Enter the 6-digit code sent to your email."}
            {verified && `Welcome, ${customer?.name || ""}! Select an order to return items from.`}
          </Text>

          {error && (
            <Banner tone="critical">{error}</Banner>
          )}

          {/* Step 1: Request OTP */}
          {!otpSent && !verified && (
            <fetcher.Form method="post">
              <input type="hidden" name="_action" value="request_otp" />
              <input type="hidden" name="shop" value={shop} />
              <BlockStack gap="300">
                <TextField
                  label="Email Address"
                  type="email"
                  name="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="your@email.com"
                  autoComplete="email"
                  required
                />
                <Button submit variant="primary" loading={isSubmitting && fetcher.formData?.get("_action") === "request_otp"} disabled={!email}>
                  Send Verification Code
                </Button>
              </BlockStack>
            </fetcher.Form>
          )}

          {/* Step 2: Verify OTP */}
          {otpSent && !verified && (
            <fetcher.Form method="post">
              <input type="hidden" name="_action" value="verify_otp" />
              <input type="hidden" name="shop" value={shop} />
              <input type="hidden" name="email" value={data.email || email} />
              <BlockStack gap="300">
                <TextField
                  label="Verification Code"
                  type="text"
                  name="code"
                  value={code}
                  onChange={setCode}
                  placeholder="000000"
                  maxLength={6}
                  autoComplete="one-time-code"
                  required
                />
                <Button submit variant="primary" loading={isSubmitting && fetcher.formData?.get("_action") === "verify_otp"} disabled={code.length !== 6}>
                  Verify & Look Up Orders
                </Button>
              </BlockStack>
            </fetcher.Form>
          )}

          {/* Step 3: Enter Order Number (after OTP verification) */}
          {verified && data?.needsOrderNumber && !orders?.length && (
            <fetcher.Form method="post">
              <input type="hidden" name="_action" value="lookup_order" />
              <input type="hidden" name="shop" value={shop} />
              <input type="hidden" name="email" value={data.email || email} />
              <BlockStack gap="300">
                <TextField
                  label="Order Number"
                  type="text"
                  name="orderName"
                  value={orderNumber}
                  onChange={setOrderNumber}
                  placeholder="e.g. #1001 or 1001"
                />
                <Button submit variant="primary" loading={isSubmitting} disabled={!orderNumber}>
                  Find Order
                </Button>
              </BlockStack>
            </fetcher.Form>
          )}

          {/* Step 4: Orders (after order lookup) */}
          {verified && orders.length > 0 && (
            <BlockStack gap="300">
              {orders.map((order: any) => {
                const orderTotal = parseFloat(order.total);
                const isSelected = selectedOrder === order.id;
                return (
                  <Card key={order.id} background={isSelected ? "bg-surface-experimental" : undefined}>
                    <div style={{ cursor: "pointer" }} onClick={() => {
                      setSelectedOrder(isSelected ? null : order.id);
                      setSelectedItems([]);
                    }}>
                      <InlineStack align="space-between">
                        <BlockStack gap="100">
                          <Text variant="headingSm" as="h3" fontWeight="bold">{order.name}</Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {new Date(order.createdAt).toLocaleDateString()} · {order.currency} ${orderTotal.toFixed(2)}
                          </Text>
                        </BlockStack>
                        {order.fulfilled && <Text variant="bodySm" as="span" tone="success">Delivered</Text>}
                      </InlineStack>
                    </div>

                    {isSelected && (
                      <div style={{ marginTop: 16 }}>
                        <fetcher.Form method="post">
                          <input type="hidden" name="_action" value="submit_return" />
                          <input type="hidden" name="shop" value={shop} />
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="orderName2" value={order.name} />
                          <input type="hidden" name="customerName" value={customer?.name || ""} />
                          <input type="hidden" name="email" value={data.email || ""} />
                          <input type="hidden" name="customerEmail" value={data.email || ""} />
                          <BlockStack gap="300">
                            <Text variant="headingSm" as="h4" fontWeight="bold">Items to return:</Text>
                            <Text variant="bodySm" as="p" tone="subdued">
                              Enter item names separated by commas (e.g. "Leather Jacket, T-Shirt")
                            </Text>
                            <input type="text" name="manualItemNames" placeholder="e.g. Leather Jacket, T-Shirt"
                              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }} />
                            <TextField label="Reason for return" name="reason" value={reason} onChange={setReason}
                              placeholder="e.g. Wrong size, defective, changed mind..." multiline={2} />
                            <Button submit variant="primary" disabled={!reason}>
                              Submit Return Request
                            </Button>
                          </BlockStack>
                        </fetcher.Form>
                      </div>
                    )}
                  </Card>
                );
              })}
            </BlockStack>
          )}

          {verified && orders.length === 0 && !error && (
            <Banner tone="info">
              <p>No orders found for this email.</p>
            </Banner>
          )}
        </BlockStack>
      </Card>
    </div>
  );
}
