import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import * as crypto from "node:crypto";
import {
  Page, Layout, Card, BlockStack, Text, Banner, Button, InlineStack, TextField, Select,
} from "@shopify/polaris";
import { useState } from "react";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shop: session.shop } });
  const config: any = shop?.config || {};
  return json({
    hasMcpKey: !!shop?.mcpApiKeyHash,
    labelConfig: {
      provider: config.labelProvider || "",
      sendcloudKey: config.sendcloudKey ? "***" : "",
      sendcloudSecret: config.sendcloudSecret ? "***" : "",
      shippoKey: config.shippoKey ? "***" : "",
      easypostKey: config.easypostKey ? "***" : "",
    },
  });
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

  if (_action === "save_labels") {
    const shopRec = await prisma.shop.findUnique({ where: { shop: session.shop } });
    const currentConfig: any = shopRec?.config || {};

    const provider = formData.get("provider") as string;
    const sendcloudKey = formData.get("sendcloudKey") as string;
    const sendcloudSecret = formData.get("sendcloudSecret") as string;
    const shippoKey = formData.get("shippoKey") as string;
    const easypostKey = formData.get("easypostKey") as string;

    await prisma.shop.update({
      where: { shop: session.shop },
      data: {
        config: {
          ...currentConfig,
          labelProvider: provider,
          // Only update if a new value is provided (not masked "***")
          ...(sendcloudKey && sendcloudKey !== "***" ? { sendcloudKey } : {}),
          ...(sendcloudSecret && sendcloudSecret !== "***" ? { sendcloudSecret } : {}),
          ...(shippoKey && shippoKey !== "***" ? { shippoKey } : {}),
          ...(easypostKey && easypostKey !== "***" ? { easypostKey } : {}),
        },
      },
    });
    return json({ saved: true });
  }

  return json({ ok: true });
};

export default function SettingsPage() {
  const { hasMcpKey, labelConfig } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [copied, setCopied] = useState(false);
  const newKey = fetcher.data?.newKey;
  const saved = fetcher.data?.saved;

  const [provider, setProvider] = useState(labelConfig.provider || "sendcloud");
  const [scKey, setScKey] = useState(labelConfig.sendcloudKey);
  const [scSecret, setScSecret] = useState(labelConfig.sendcloudSecret);
  const [shKey, setShKey] = useState(labelConfig.shippoKey);
  const [epKey, setEpKey] = useState(labelConfig.easypostKey);

  return (
    <Page title="Settings">
      <Layout>
        <Layout.Section>
          {saved && <Banner tone="success"><Text variant="bodyMd" as="p">Label provider settings saved!</Text></Banner>}

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2" fontWeight="bold">MCP Server</Text>
              <Banner tone="info">
                <Text variant="bodyMd" as="p">Endpoint: <code>https://returns.greeknous.com/api/mcp</code></Text>
              </Banner>

              {newKey ? (
                <BlockStack gap="200">
                  <Banner tone="critical"><Text variant="bodyMd" as="p">Save this key now — it will not be shown again!</Text></Banner>
                  <div style={{ background: "#1a1a2e", color: "#fff", padding: 12, borderRadius: 6, fontFamily: "monospace", wordBreak: "break-all" }}>
                    {newKey}
                  </div>
                  <Button onClick={() => { navigator.clipboard.writeText(newKey); setCopied(true); }}>
                    {copied ? "Copied!" : "Copy to clipboard"}
                  </Button>
                </BlockStack>
              ) : (
                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    {hasMcpKey ? "An MCP key exists. Generate a new one to replace it." : "No MCP key yet. Generate one for AI agent access."}
                  </Text>
                  <Button variant="primary" onClick={() => fetcher.submit({ _action: "generate_key" }, { method: "post" })}>
                    {hasMcpKey ? "Regenerate Key" : "Generate MCP Key"}
                  </Button>
                </BlockStack>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2" fontWeight="bold">Label Provider</Text>
              <Text variant="bodyMd" as="p">
                Choose your shipping provider and enter your API credentials. The AI agent will generate return labels automatically.
              </Text>

              <fetcher.Form method="post">
                <input type="hidden" name="_action" value="save_labels" />
                <BlockStack gap="300">
                  <Select
                    label="Provider"
                    name="provider"
                    value={provider}
                    onChange={setProvider}
                    options={[
                      { label: "SendCloud (EU/NL — PostNL, DHL, DPD)", value: "sendcloud" },
                      { label: "Shippo (US/Global — UPS, FedEx, USPS)", value: "shippo" },
                      { label: "EasyPost (Global — UPS, FedEx, DHL, DPD)", value: "easypost" },
                    ]}
                  />

                  {provider === "sendcloud" && (
                    <BlockStack gap="200">
                      <TextField label="SendCloud API Key" name="sendcloudKey" value={scKey} onChange={setScKey} autoComplete="off" placeholder={scKey === "***" ? "•••••••• (saved)" : "Enter your API key"} />
                      <TextField label="SendCloud API Secret" name="sendcloudSecret" type="password" value={scSecret} onChange={setScSecret} autoComplete="off" placeholder={scSecret === "***" ? "•••••••• (saved)" : "Enter your API secret"} />
                    </BlockStack>
                  )}

                  {provider === "shippo" && (
                    <TextField label="Shippo API Key" name="shippoKey" value={shKey} onChange={setShKey} autoComplete="off" placeholder={shKey === "***" ? "•••••••• (saved)" : "Enter your API key"} />
                  )}

                  {provider === "easypost" && (
                    <TextField label="EasyPost API Key" name="easypostKey" value={epKey} onChange={setEpKey} autoComplete="off" placeholder={epKey === "***" ? "•••••••• (saved)" : "Enter your API key"} />
                  )}

                  <Button submit variant="primary">Save Provider Settings</Button>
                </BlockStack>
              </fetcher.Form>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2" fontWeight="bold">Email</Text>
              <Banner tone="success"><Text variant="bodyMd" as="p">Email notifications active via VPS mail relay. Customers receive automatic emails on approve/deny/refund.</Text></Banner>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}