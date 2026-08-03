import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import * as crypto from "node:crypto";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Banner,
  Button,
  CopyToClipboard,
  InlineStack,
} from "@shopify/polaris";
import { useState } from "react";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shop: session.shop } });
  return json({ hasMcpKey: !!shop?.mcpApiKeyHash });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const formData = await request.formData();
  const _action = formData.get("_action");

  if (_action === "generate_key") {
    const key = "shpg_returns_" + [...Array(32)].map(() => Math.random().toString(36)[2]).join("");
    const hash = crypto.createHash("sha256").update(key).digest("hex");

    await prisma.shop.upsert({
      where: { shop: session.shop },
      create: { id: session.shop, shop: session.shop, mcpApiKeyHash: hash },
      update: { mcpApiKeyHash: hash },
    });

    return json({ newKey: key });
  }

  return json({ ok: true });
};

export default function SettingsPage() {
  const { hasMcpKey } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [copied, setCopied] = useState(false);

  const newKey = fetcher.data?.newKey;

  return (
    <Page title="Settings">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2" fontWeight="bold">
                MCP Server
              </Text>
              <Text variant="bodyMd" as="p">
                The MCP (Model Context Protocol) server lets AI agents like Claude,
                Codex, or Grok connect to your return management system. They can
                analyze returns, approve/deny, check fraud, and apply policies.
              </Text>

              <Banner tone="info">
                <p>
                  <strong>Endpoint:</strong>{" "}
                  <code>https://returns-app-production-8384.up.railway.app/api/mcp</code>
                </p>
              </Banner>

              {newKey ? (
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3" tone="critical">
                      ⚠️ Save this key now — it will not be shown again!
                    </Text>
                    <div style={{
                      background: "#1a1a2e", color: "#fff", padding: 12,
                      borderRadius: 6, fontFamily: "monospace", wordBreak: "break-all", fontSize: 14,
                    }}>
                      {newKey}
                    </div>
                    <Button onClick={() => {
                      navigator.clipboard.writeText(newKey);
                      setCopied(true);
                    }}>
                      {copied ? "Copied!" : "Copy to clipboard"}
                    </Button>
                  </BlockStack>
                </Card>
              ) : (
                <>
                  <Text variant="bodyMd" as="p">
                    {hasMcpKey
                      ? "An MCP API key has been generated. You can generate a new one (the old key will stop working)."
                      : "No MCP API key has been generated yet. Generate one to enable AI agent access."}
                  </Text>
                  <div>
                    <Button
                      variant="primary"
                      onClick={() => {
                        fetcher.submit({ _action: "generate_key" }, { method: "post" });
                      }}
                    >
                      {hasMcpKey ? "Regenerate Key" : "Generate MCP Key"}
                    </Button>
                  </div>
                </>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2" fontWeight="bold">
                Email Notifications
              </Text>
              <Text variant="bodyMd" as="p">
                When the AI agent approves or denies a return, the customer receives an automatic email.
              </Text>
              <Banner tone="info">
                <p>
                  To enable emails, sign up at <strong>resend.com</strong> (free tier: 100 emails/day),
                  get an API key, and set it as a Railway variable:
                </p>
                <p>
                  <code>RESEND_API_KEY=re_xxxxxxxxxxxx</code>
                </p>
                <p style="margin-top: 8px;">
                  Optionally set your sender email: <code>EMAIL_FROM=returns@yourdomain.com</code>
                </p>
              </Banner>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}