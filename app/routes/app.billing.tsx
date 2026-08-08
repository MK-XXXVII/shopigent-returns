import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Text,
  Card,
  BlockStack,
  InlineStack,
  InlineGrid,
  Badge,
  Button,
  Box,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../lib/db.server";

const PLANS = [
  {
    key: "free", name: "Free", price: 0,
    tagline: "AI-powered return management essentials.",
    features: [
      "10 returns/month",
      "Basic policy engine",
      "Customer return portal",
      "MCP read-only access",
      "Email support",
    ],
  },
  {
    key: "growth", name: "Growth", price: 9.99, highlight: true, badge: "Most popular",
    tagline: "Automate returns with AI agents.",
    features: [
      "Unlimited returns",
      "Auto-approve policies",
      "Fraud detection",
      "Full MCP access (read + write)",
      "Refund execution",
      "Email notifications",
      "Analytics dashboard",
      "7-day free trial",
    ],
  },
  {
    key: "pro", name: "Pro", price: 29, badge: "Best value",
    tagline: "Everything automated — labels, exchanges, SMS.",
    features: [
      "Everything in Growth",
      "Label generation (SendCloud/Shippo/EasyPost)",
      "Exchange workflow",
      "SMS alerts",
      "Advanced fraud detection",
      "Full analytics + export",
      "Priority support",
      "7-day free trial",
    ],
  },
] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.upsert({
    where: { shop: session.shop },
    update: {},
    create: { shop: session.shop, id: session.shop },
  });
  return { currentPlan: shop.planName, planStatus: shop.planStatus };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const planKey = String(formData.get("planKey"));
  const plan = PLANS.find((p) => p.key === planKey);
  if (!plan) return Response.json({ ok: false, error: "Unknown plan" });

  const appHandle = process.env.SHOPIFY_APP_HANDLE || "shopigent-returns";
  const shopName = session.shop.replace(/\.myshopify\.com$/, "");
  const pricingUrl = `https://admin.shopify.com/store/${shopName}/charges/${appHandle}/pricing_plans`;

  // Optimistic update — webhook reconciles later
  await prisma.shop.upsert({
    where: { shop: session.shop },
    update: { planName: planKey, planStatus: "active" },
    create: { shop: session.shop, id: session.shop, planName: planKey, planStatus: "active" },
  }).catch(() => {});

  return Response.json({ ok: true, redirectUrl: pricingUrl });
};

export default function BillingPage() {
  const { currentPlan } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const choosePlan = (planKey: string) => fetcher.submit({ planKey }, { method: "POST" });

  if (fetcher.data?.ok === true && fetcher.data.redirectUrl) {
    window.top!.location.href = fetcher.data.redirectUrl;
  }

  return (
    <Page>
      <TitleBar title="Billing" />
      {fetcher.data?.ok === false && (
        <Banner tone="critical">
          <Text as="p" variant="bodyMd">Billing error: {fetcher.data.error}</Text>
        </Banner>
      )}
      <BlockStack gap="500">
        <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key;
            const isPopular = (plan as any).highlight;
            return (
              <Card key={plan.key}>
                <BlockStack gap="400" align="space-between">
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingLg">{plan.name}</Text>
                        {(plan as any).badge && (
                          <Badge tone={isPopular ? "success" : "info"}>{(plan as any).badge}</Badge>
                        )}
                      </InlineStack>
                      {isCurrent && <Badge tone="success">Current</Badge>}
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">{(plan as any).tagline}</Text>
                    <Box minHeight="56">
                      <InlineStack gap="100" blockAlign="baseline">
                        <Text as="p" variant="heading2xl">
                          {plan.price === 0 ? "Free" : `$${plan.price}`}
                        </Text>
                        {plan.price > 0 && (
                          <Text as="span" variant="bodyMd" tone="subdued">/month</Text>
                        )}
                      </InlineStack>
                    </Box>
                    <Box>
                      <BlockStack gap="150">
                        {plan.features.map((f) => (
                          <Box key={f} background="bg-surface-secondary" padding="200" borderRadius="200">
                            <InlineStack gap="150" align="start">
                              <span style={{ color: "var(--p-color-text-success)", fontWeight: 700 }}>✓</span>
                              <Text as="p" variant="bodySm">{f}</Text>
                            </InlineStack>
                          </Box>
                        ))}
                      </BlockStack>
                    </Box>
                  </BlockStack>
                  <Button
                    variant="secondary"
                    disabled={isCurrent}
                    loading={fetcher.state !== "idle"}
                    onClick={() => choosePlan(plan.key)}
                    fullWidth
                    size="large"
                  >
                    {isCurrent ? "Current plan" : plan.price === 0 ? "Get started" : "Choose plan"}
                  </Button>
                </BlockStack>
              </Card>
            );
          })}
        </InlineGrid>
        <Banner tone="info">
          <Text as="p" variant="bodyMd">
            Paid plans include a 7-day free trial. You can upgrade, downgrade, or cancel anytime.
          </Text>
        </Banner>
      </BlockStack>
    </Page>
  );
}