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
            <Text variant="headingMd" as="h2" fontWeight="bold">MCP Server</Text>
            <Text variant="bodyMd" as="p">
              Endpoint: <code>https://returns-app-production-8384.up.railway.app/api/mcp</code>
            </Text>

            {newKey ? (
              <BlockStack gap="200">
                <Banner tone="critical">
                  <Text variant="bodyMd" as="p">Save this key now — it will not be shown again!</Text>
                </Banner>
                <div style={{ background: "#1a1a2e", color: "#fff", padding: 12, borderRadius: 6, fontFamily: "monospace" }}>
                  {newKey}
                </div>
                <Button onClick={() => { navigator.clipboard.writeText(newKey); setCopied(true); }}>
                  {copied ? "Copied!" : "Copy to clipboard"}
                </Button>
              </BlockStack>
            ) : (
              <BlockStack gap="200">
                <Text variant="bodyMd" as="p">
                  {hasMcpKey ? "Key exists. Generate a new one to replace it." : "No MCP key yet."}
                </Text>
                <Button variant="primary" onClick={() => fetcher.submit({ _action: "generate_key" }, { method: "post" })}>
                  {hasMcpKey ? "Regenerate Key" : "Generate MCP Key"}
                </Button>
              </BlockStack>
            )}
          </Card>

          <Card>
            <Text variant="headingMd" as="h2" fontWeight="bold">Email</Text>
            <Banner tone="success">
              <Text variant="bodyMd" as="p">Active via VPS mail relay.</Text>
            </Banner>
          </Card>

          <Card>
            <Text variant="headingMd" as="h2" fontWeight="bold">Labels</Text>
            <Banner tone="info">
              <Text variant="bodyMd" as="p">Providers: SendCloud, Shippo, EasyPost.</Text>
            </Banner>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}