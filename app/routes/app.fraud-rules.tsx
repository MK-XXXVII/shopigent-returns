import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, Text, Banner, Button, InlineStack, TextField,
  Tag, Checkbox,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";
import {
  DEFAULT_FRAUD_RULES,
  validateFraudRules,
  type FraudRulesConfig,
} from "../lib/fraud-rules.server";

interface ActionData {
  saved?: boolean;
  reset?: boolean;
  error?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shop: session.shop } });
  const config: any = shop?.config || {};
  const rules: FraudRulesConfig = {
    maxReturnsPerCustomer:
      config.fraudRules?.maxReturnsPerCustomer ?? DEFAULT_FRAUD_RULES.maxReturnsPerCustomer,
    maxReturnsWindowDays:
      config.fraudRules?.maxReturnsWindowDays ?? DEFAULT_FRAUD_RULES.maxReturnsWindowDays,
    maxValuePerReturn:
      config.fraudRules?.maxValuePerReturn ?? DEFAULT_FRAUD_RULES.maxValuePerReturn,
    blockedCountries: config.fraudRules?.blockedCountries ?? DEFAULT_FRAUD_RULES.blockedCountries,
    suspiciousEmailDomains: config.fraudRules?.suspiciousEmailDomains ?? DEFAULT_FRAUD_RULES.suspiciousEmailDomains,
    enabled: config.fraudRules?.enabled !== false,
  };
  return json({ rules });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  if (_action === "save_rules") {
    const raw: Record<string, any> = {};

    const maxReturns = parseInt(formData.get("maxReturnsPerCustomer") as string, 10);
    const windowDays = parseInt(formData.get("maxReturnsWindowDays") as string, 10);
    const maxValue = parseFloat(formData.get("maxValuePerReturn") as string);

    raw.maxReturnsPerCustomer = isNaN(maxReturns) ? DEFAULT_FRAUD_RULES.maxReturnsPerCustomer : maxReturns;
    raw.maxReturnsWindowDays = isNaN(windowDays) ? DEFAULT_FRAUD_RULES.maxReturnsWindowDays : windowDays;
    raw.maxValuePerReturn = isNaN(maxValue) ? DEFAULT_FRAUD_RULES.maxValuePerReturn : maxValue;

    const countriesRaw = (formData.get("blockedCountries") as string || "").trim();
    raw.blockedCountries = countriesRaw
      ? countriesRaw.split(",").map((s: string) => s.trim().toUpperCase()).filter(Boolean)
      : [];

    const domainsRaw = (formData.get("suspiciousEmailDomains") as string || "").trim();
    raw.suspiciousEmailDomains = domainsRaw
      ? domainsRaw.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
      : [];

    raw.enabled = formData.get("enabled") === "true";

    const errors = validateFraudRules(raw);
    if (errors.length > 0) {
      return json({ error: errors.join("; ") } satisfies ActionData, { status: 400 });
    }

    const shopRec = await prisma.shop.findUnique({ where: { shop: session.shop } });
    const currentConfig: any = shopRec?.config || {};

    await prisma.shop.update({
      where: { shop: session.shop },
      data: {
        config: {
          ...currentConfig,
          fraudRules: raw,
        },
      },
    });

    return json({ saved: true } satisfies ActionData);
  }

  if (_action === "reset_defaults") {
    const shopRec = await prisma.shop.findUnique({ where: { shop: session.shop } });
    const currentConfig: any = shopRec?.config || {};
    const { fraudRules: _, ...rest } = currentConfig;

    await prisma.shop.update({
      where: { shop: session.shop },
      data: { config: rest },
    });

    return json({ reset: true } satisfies ActionData);
  }

  return json({ ok: true });
};

function countriesList(rules: FraudRulesConfig): string {
  return (rules.blockedCountries || []).join(", ");
}

function domainsList(rules: FraudRulesConfig): string {
  return (rules.suspiciousEmailDomains || []).join(", ");
}

export default function FraudRulesPage() {
  const { rules: initialRules } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();

  const [maxReturns, setMaxReturns] = useState(String(initialRules.maxReturnsPerCustomer));
  const [windowDays, setWindowDays] = useState(String(initialRules.maxReturnsWindowDays));
  const [maxValue, setMaxValue] = useState(String(initialRules.maxValuePerReturn));
  const [countries, setCountries] = useState(countriesList(initialRules));
  const [domains, setDomains] = useState(domainsList(initialRules));
  const [enabled, setEnabled] = useState(initialRules.enabled);
  const [countryInput, setCountryInput] = useState("");
  const [domainInput, setDomainInput] = useState("");

  const saved = fetcher.data?.saved === true;
  const reset = fetcher.data?.reset === true;
  const error = fetcher.data?.error;
  const isSaving = fetcher.state === "submitting";

  const countryTags = countries
    ? countries.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const domainTags = domains
    ? domains.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const addCountryTag = useCallback(() => {
    const val = countryInput.trim().toUpperCase();
    if (!val) return;
    const existing = countries ? countries.split(",").map((s) => s.trim().toUpperCase()) : [];
    if (existing.includes(val)) return;
    const next = [...existing, val].join(", ");
    setCountries(next);
    setCountryInput("");
  }, [countryInput, countries]);

  const removeCountryTag = useCallback((tag: string) => {
    const existing = countries ? countries.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const next = existing.filter((t) => t.toUpperCase() !== tag.toUpperCase()).join(", ");
    setCountries(next);
  }, [countries]);

  const addDomainTag = useCallback(() => {
    const val = domainInput.trim().toLowerCase();
    if (!val) return;
    const existing = domains ? domains.split(",").map((s) => s.trim().toLowerCase()) : [];
    if (existing.includes(val)) return;
    const next = [...existing, val].join(", ");
    setDomains(next);
    setDomainInput("");
  }, [domainInput, domains]);

  const removeDomainTag = useCallback((tag: string) => {
    const existing = domains ? domains.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const next = existing.filter((t) => t.toLowerCase() !== tag.toLowerCase()).join(", ");
    setDomains(next);
  }, [domains]);

  return (
    <Page title="Fraud Rules">
      <Layout>
        <Layout.Section>
          {saved && <Banner tone="success"><Text variant="bodyMd" as="p">Fraud rules saved successfully!</Text></Banner>}
          {reset && <Banner tone="success"><Text variant="bodyMd" as="p">Fraud rules reset to defaults.</Text></Banner>}
          {error && <Banner tone="critical"><Text variant="bodyMd" as="p">{error}</Text></Banner>}

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2" fontWeight="bold">Custom Fraud Rules</Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Configure advanced fraud detection rules for the AI agent. These rules are evaluated
                alongside built-in checks when the agent analyzes a return request. Rules that trigger
                will increase the risk score and may flag the return for manual review.
              </Text>

              <fetcher.Form method="post">
                <input type="hidden" name="_action" value="save_rules" />
                <input type="hidden" name="enabled" value={String(enabled)} />
                <input type="hidden" name="blockedCountries" value={countries} />
                <input type="hidden" name="suspiciousEmailDomains" value={domains} />

                <BlockStack gap="400">
                  {/* Enable/disable */}
                  <Checkbox
                    label="Enable custom fraud rules"
                    checked={enabled}
                    onChange={(v) => setEnabled(v)}
                  />

                  {/* ─── Max Returns per Customer ─────────────── */}
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3" fontWeight="semibold">Max Returns Per Customer</Text>
                    <InlineStack gap="200" wrap={false}>
                      <div style={{ flex: 1 }}>
                        <TextField
                          label="Max returns"
                          type="number"
                          name="maxReturnsPerCustomer"
                          value={maxReturns}
                          onChange={setMaxReturns}
                          autoComplete="off"
                          placeholder="3"
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <TextField
                          label="Within (days)"
                          type="number"
                          name="maxReturnsWindowDays"
                          value={windowDays}
                          onChange={setWindowDays}
                          autoComplete="off"
                          placeholder="30"
                        />
                      </div>
                    </InlineStack>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Flags a customer who exceeds this many return requests within the given window.
                    </Text>
                  </BlockStack>

                  {/* ─── Max Value Per Return ─────────────────── */}
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3" fontWeight="semibold">Max Value Per Return</Text>
                    <TextField
                      label="Maximum return value ($)"
                      type="number"
                      name="maxValuePerReturn"
                      value={maxValue}
                      onChange={setMaxValue}
                      autoComplete="off"
                      prefix="$"
                      placeholder="5000"
                    />
                    <Text variant="bodySm" as="p" tone="subdued">
                      Flags a return whose total item value exceeds this amount.
                    </Text>
                  </BlockStack>

                  {/* ─── Blocked Countries ────────────────── */}
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3" fontWeight="semibold">Blocked Countries</Text>
                    <InlineStack gap="200" wrap={false}>
                      <div style={{ flex: 1 }}>
                        <TextField
                          label="Add country code"
                          value={countryInput}
                          onChange={setCountryInput}
                          placeholder="e.g. RU"
                          autoComplete="off"
                          connectedRight={
                            <Button onClick={addCountryTag}>Add</Button>
                          }
                        />
                      </div>
                    </InlineStack>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Use ISO 3166-1 alpha-2 country codes (e.g. RU, KP, IR). Returns from blocked
                      countries receive the highest risk score.
                    </Text>
                    {countryTags.length > 0 && (
                      <BlockStack gap="100">
                        <Text variant="bodySm" as="p" tone="subdued">Blocked countries:</Text>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {countryTags.map((tag) => (
                            <Tag key={tag} onRemove={() => removeCountryTag(tag)}>{tag}</Tag>
                          ))}
                        </div>
                      </BlockStack>
                    )}
                  </BlockStack>

                  {/* ─── Suspicious Email Domains ─────────────── */}
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3" fontWeight="semibold">Suspicious Email Domains</Text>
                    <InlineStack gap="200" wrap={false}>
                      <div style={{ flex: 1 }}>
                        <TextField
                          label="Add domain"
                          value={domainInput}
                          onChange={setDomainInput}
                          placeholder="e.g. tempmail.com"
                          autoComplete="off"
                          connectedRight={
                            <Button onClick={addDomainTag}>Add</Button>
                          }
                        />
                      </div>
                    </InlineStack>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Disposable or temporary email domains. Returns using these domains get a high
                      risk score.
                    </Text>
                    {domainTags.length > 0 && (
                      <BlockStack gap="100">
                        <Text variant="bodySm" as="p" tone="subdued">Flagged domains:</Text>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {domainTags.map((tag) => (
                            <Tag key={tag} onRemove={() => removeDomainTag(tag)}>{tag}</Tag>
                          ))}
                        </div>
                      </BlockStack>
                    )}
                  </BlockStack>

                  <InlineStack gap="200">
                    <Button submit variant="primary" loading={isSaving} disabled={isSaving}>
                      Save Rules
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (window.confirm("Reset all fraud rules to defaults? This cannot be undone.")) {
                          fetcher.submit({ _action: "reset_defaults" }, { method: "post" });
                        }
                      }}
                    >
                      Reset to Defaults
                    </Button>
                  </InlineStack>
                </BlockStack>
              </fetcher.Form>
            </BlockStack>
          </Card>

          {/* ─── Reference Card ──────────────────────────── */}
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2" fontWeight="bold">How Fraud Rules Work</Text>
              <Text variant="bodyMd" as="p">
                When the AI agent runs <code>check_fraud</code> on a return request, these custom
                rules are evaluated alongside the built-in checks (high-value anomaly, frequent
                returner pattern).
              </Text>
              <Text variant="bodyMd" as="p">
                Each rule contributes a risk score (0–1). The highest score among all triggered rules
                determines the overall risk level:
              </Text>
              <BlockStack gap="100">
                <Text variant="bodySm" as="p"><strong>≤ 0.2</strong> → Low risk (auto-approved by default)</Text>
                <Text variant="bodySm" as="p"><strong>0.2 – 0.5</strong> → Medium risk (flagged for review)</Text>
                <Text variant="bodySm" as="p"><strong>&gt; 0.5</strong> → High risk (flagged for review)</Text>
              </BlockStack>
              <Text variant="bodySm" as="p" tone="subdued">
                Default blocked countries and suspicious domains are pre-populated when no custom
                configuration exists. Customizing overrides the defaults.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}