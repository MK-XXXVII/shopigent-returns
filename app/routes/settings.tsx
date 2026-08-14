import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, Text, Banner, Button, Select, TextField, InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import * as crypto from "node:crypto";
import { useState } from "react";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";
import { createReturnLabel } from "../lib/label-provider.server";
import { sendEmail } from "../lib/email.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shop: session.shop } });
  const config: any = shop?.config || {};
  return json({
    shopDomain: session.shop,
    hasMcpKey: !!shop?.mcpApiKeyHash,
    labelConfig: {
      provider: config.labelProvider || "",
      sendcloudKey: config.sendcloudKey ? "***" : "",
      sendcloudSecret: config.sendcloudSecret ? "***" : "",
      shippoKey: config.shippoKey ? "***" : "",
      easypostKey: config.easypostKey ? "***" : "",
    },
    shopAddress: config.shopAddress || {
      line1: process.env.SHOP_ADDRESS_LINE1 || "",
      city: process.env.SHOP_ADDRESS_CITY || "",
      postalCode: process.env.SHOP_ADDRESS_ZIP || "",
      country: process.env.SHOP_ADDRESS_COUNTRY || "NL",
      state: process.env.SHOP_ADDRESS_STATE || "",
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

    // Return address for labels
    const shopAddress = {
      line1: (formData.get("addrLine1") as string) || currentConfig.shopAddress?.line1 || "",
      line2: (formData.get("addrLine2") as string) || currentConfig.shopAddress?.line2 || "",
      city: (formData.get("addrCity") as string) || currentConfig.shopAddress?.city || "",
      postalCode: (formData.get("addrZip") as string) || currentConfig.shopAddress?.postalCode || "",
      country: (formData.get("addrCountry") as string) || currentConfig.shopAddress?.country || "NL",
      state: (formData.get("addrState") as string) || currentConfig.shopAddress?.state || "",
    };

    await prisma.shop.update({
      where: { shop: session.shop },
      data: {
        config: {
          ...currentConfig,
          labelProvider: provider,
          shopAddress,
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

  // Test label generation
  if (_action === "test_label") {
    const shopRec = await prisma.shop.findUnique({ where: { shop: session.shop } });
    const config: any = shopRec?.config || {};
    const testEmail = (formData.get("testEmail") as string) || config.testEmail || session.shop.replace(".myshopify.com", "") + "@example.com";
    const labelRequest = {
      orderName: "TEST",
      customerName: "Test Customer",
      customerEmail: testEmail,
      items: [{ title: "Test Item", quantity: 1, sku: "TEST" }],
      weight: 0.5,
      description: "Test label from Shopigent Returns",
      shopAddress: config.shopAddress || { line1: "", city: "", postalCode: "", country: "NL" },
    };
    const result = await createReturnLabel(session.shop, labelRequest);
    if (result.success && result.labelUrl) {
      await sendEmail({
        to: config.testEmail || session.shop.replace(".myshopify.com", "") + "@example.com",
        subject: "Test Label from Shopigent Returns",
        html: `<p>Test label generated successfully!</p><p><a href="${result.labelUrl}" target="_blank">Download Label</a></p>${result.trackingNumber ? `<p>Tracking: ${result.trackingNumber}</p>` : ""}<p>Cost: ${result.cost ? "$" + result.cost : "N/A"}</p>`,
        fromName: "Shopigent Returns Test",
      });
      return json({ testResult: "ok", labelUrl: result.labelUrl, tracking: result.trackingNumber });
    }
    return json({ testResult: "error", error: result.error || "Label generation failed" });
  }

  return json({ ok: true });
};

export default function SettingsPage() {
  const { shopDomain, hasMcpKey, labelConfig, shopAddress } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [copiedMcp, setCopiedMcp] = useState(false);
  const [copiedPortal, setCopiedPortal] = useState(false);
  const newKey = fetcher.data?.newKey;
  const saved = fetcher.data?.saved;

  const [provider, setProvider] = useState(labelConfig.provider || "sendcloud");
  const [scKey, setScKey] = useState(labelConfig.sendcloudKey);
  const [scSecret, setScSecret] = useState(labelConfig.sendcloudSecret);
  const [shKey, setShKey] = useState(labelConfig.shippoKey);
  const [epKey, setEpKey] = useState(labelConfig.easypostKey);
  const [addrLine1, setAddrLine1] = useState(shopAddress.line1);
  const [addrLine2, setAddrLine2] = useState(shopAddress.line2 || "");
  const [addrCity, setAddrCity] = useState(shopAddress.city);
  const [addrZip, setAddrZip] = useState(shopAddress.postalCode);
  const [addrCountry, setAddrCountry] = useState(shopAddress.country);
  const [addrState, setAddrState] = useState(shopAddress.state || "");

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
                  <Button onClick={() => { navigator.clipboard.writeText(newKey); setCopiedMcp(true); }}>
                    {copiedMcp ? "Copied!" : "Copy to clipboard"}
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
              <Text variant="headingMd" as="h2" fontWeight="bold">Return Portal</Text>
              <Text variant="bodyMd" as="p">
                Give your customers a self-service return page. Add the link below to your store's navigation menu.
              </Text>

              <Banner tone="info">
                <Text variant="bodyMd" as="p">
                  Portal URL: <code style={{ wordBreak: "break-all" }}>https://returns.greeknous.com/return?shop={shopDomain}</code>
                </Text>
              </Banner>

              <Button onClick={() => { navigator.clipboard.writeText(`https://returns.greeknous.com/return?shop=${shopDomain}`); setCopiedPortal(true); }}>
                {copiedPortal ? "Copied!" : "📋 Copy Portal Link"}
              </Button>

              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" fontWeight="semibold">How to add to navigation</Text>
                <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                  <li>Go to your Shopify Admin → <strong>Online Store → Navigation</strong></li>
                  <li>Click <strong>Main menu</strong> (or the menu of your choice)</li>
                  <li>Click <strong>Add menu item</strong></li>
                  <li>Name: <code>Start a Return</code></li>
                  <li>Link: paste the portal URL above</li>
                  <li>Click <strong>Save menu</strong></li>
                </ol>
              </BlockStack>

              <Text variant="bodySm" as="p" tone="subdued">
                Customers will verify their email with a one-time code before seeing their orders. Full guide: <a href="https://returns-docs-production.up.railway.app/guides/return-portal" target="_blank" rel="noreferrer">docs</a>
              </Text>
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

                  <div style={{ marginTop: 16, borderTop: "1px solid #e1e3e5", paddingTop: 16 }}>
                    <Text variant="headingSm" as="h3" fontWeight="bold">Return Address (from address on label)</Text>
                    <BlockStack gap="200">
                      <TextField label="Address Line 1" name="addrLine1" value={addrLine1} onChange={setAddrLine1} placeholder="Street, number" autoComplete="off" />
                      <TextField label="Address Line 2 (optional)" name="addrLine2" value={addrLine2} onChange={setAddrLine2} autoComplete="off" />
                      <TextField label="City" name="addrCity" value={addrCity} onChange={setAddrCity} autoComplete="off" />
                      <TextField label="Postal / ZIP code" name="addrZip" value={addrZip} onChange={setAddrZip} autoComplete="off" />
                      <TextField label="State/Province (optional)" name="addrState" value={addrState} onChange={setAddrState} autoComplete="off" />
                      <TextField label="Country (ISO code, e.g. NL, US, DE)" name="addrCountry" value={addrCountry} onChange={setAddrCountry} autoComplete="off" />
                    </BlockStack>
                  </div>

                  <Button submit variant="primary">Save Provider Settings</Button>
                </BlockStack>
              </fetcher.Form>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2" fontWeight="bold">Test Label Generation</Text>
              <Text variant="bodyMd" as="p" tone="subdued">Click below to generate a test return label using your configured provider. The label PDF link will be emailed to you.</Text>
              <fetcher.Form method="post" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <input type="hidden" name="_action" value="test_label" />
                <TextField label="Send to email" name="testEmail" placeholder="kalogeras84@gmail.com" autoComplete="off" />
                <Button submit loading={fetcher.state !== "idle"}>
                  📬 Generate & Send
                </Button>
              </fetcher.Form>
              {fetcher.data?.testResult === "ok" && (
                <Banner tone="success">
                  <p>✓ Label generated! <a href={fetcher.data.labelUrl} target="_blank" rel="noopener noreferrer">Download PDF</a></p>
                  {fetcher.data.tracking && <p>Tracking: {fetcher.data.tracking}</p>}
                </Banner>
              )}
              {fetcher.data?.testResult === "error" && (
                <Banner tone="critical"><p>✗ {fetcher.data.error}</p></Banner>
              )}
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