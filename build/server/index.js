import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { RemixServer, useLoaderData, Meta, Links, Outlet, Link, ScrollRestoration, Scripts, useRouteError, isRouteErrorResponse, useFetcher } from '@remix-run/react';
import { renderToString } from 'react-dom/server';
import { AppProvider, Page, Layout, Banner, Text, Card, BlockStack, Checkbox, InlineStack, TextField, Button, Tag, useIndexResourceState, IndexTable, Link as Link$1, Badge, EmptyState, Modal, Select, InlineGrid, Box } from '@shopify/polaris';
import { AppProvider as AppProvider$1 } from '@shopify/shopify-app-remix/react';
import { NavMenu, TitleBar } from '@shopify/app-bridge-react';
import '@shopify/shopify-app-remix/server/adapters/node';
import { shopifyApp, AppDistribution, ApiVersion } from '@shopify/shopify-app-remix/server';
import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma';
import { BillingInterval } from '@shopify/shopify-api';
import { PrismaClient } from '@prisma/client';
import { json } from '@remix-run/node';
import * as crypto from 'node:crypto';
import { useState, useCallback, useEffect } from 'react';

function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  let markup = renderToString(
    /* @__PURE__ */ jsx(RemixServer, { context: remixContext, url: request.url })
  );
  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders
  });
}

const entryServer = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: handleRequest
}, Symbol.toStringTag, { value: 'Module' }));

const polarisStyles = "/assets/styles-DqWBAKNB.css";

let prisma;
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}
const prisma$1 = prisma;

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY || "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October24,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/api/auth",
  sessionStorage: new PrismaSessionStorage(prisma$1),
  distribution: AppDistribution.AppStore,
  billing: {
    free: {
      lineItems: [
        { amount: 0, currencyCode: "USD", interval: BillingInterval.Every30Days }
      ]
    },
    growth: {
      lineItems: [
        { amount: 9.99, currencyCode: "USD", interval: BillingInterval.Every30Days }
      ]
    },
    pro: {
      lineItems: [
        { amount: 29, currencyCode: "USD", interval: BillingInterval.Every30Days }
      ]
    }
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    expiringOfflineAccessTokens: true
  }
});
const authenticate = shopify.authenticate;
shopify.login;
const registerWebhooks = shopify.registerWebhooks;
shopify.sessionStorage;

const links = () => [{ rel: "stylesheet", href: polarisStyles }];
const loader$f = async ({ request }) => {
  const url = new URL(request.url);
  const isPublic = url.pathname.startsWith("/return");
  if (!isPublic) {
    await authenticate.admin(request);
  }
  return { apiKey: process.env.SHOPIFY_API_KEY || "", isPublic };
};
function App() {
  const { apiKey, isPublic } = useLoaderData();
  return /* @__PURE__ */ jsxs("html", { children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width,initial-scale=1" }),
      /* @__PURE__ */ jsx("link", { rel: "preconnect", href: "https://cdn.shopify.com/" }),
      /* @__PURE__ */ jsx(
        "link",
        {
          rel: "stylesheet",
          href: "https://cdn.shopify.com/static/fonts/inter/v4/inter.css"
        }
      ),
      /* @__PURE__ */ jsx(Meta, {}),
      /* @__PURE__ */ jsx(Links, {})
    ] }),
    /* @__PURE__ */ jsxs("body", { children: [
      isPublic ? /* @__PURE__ */ jsx(AppProvider, { i18n: {}, children: /* @__PURE__ */ jsx(Outlet, {}) }) : /* @__PURE__ */ jsxs(AppProvider$1, { isEmbeddedApp: true, apiKey, children: [
        /* @__PURE__ */ jsxs(NavMenu, { children: [
          /* @__PURE__ */ jsx(Link, { to: "/", children: "Dashboard" }),
          /* @__PURE__ */ jsx(Link, { to: "/policies", children: "Policies" }),
          /* @__PURE__ */ jsx(Link, { to: "/returns", children: "Returns" }),
          /* @__PURE__ */ jsx(Link, { to: "/analytics", children: "Analytics" }),
          /* @__PURE__ */ jsx(Link, { to: "/app/billing", children: "Billing" }),
          /* @__PURE__ */ jsx(Link, { to: "/settings", children: "Settings" }),
          /* @__PURE__ */ jsx(Link, { to: "/app/fraud-rules", children: "Fraud Rules" })
        ] }),
        /* @__PURE__ */ jsx(Outlet, {})
      ] }),
      /* @__PURE__ */ jsx(ScrollRestoration, {}),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsxs("h1", { children: [
        error.status,
        " ",
        error.statusText
      ] }),
      /* @__PURE__ */ jsx("p", { children: error.data })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h1", { children: "Error" }),
    /* @__PURE__ */ jsx("p", { children: error?.message ?? "Unknown error" })
  ] });
}

const route0 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: App,
  links,
  loader: loader$f
}, Symbol.toStringTag, { value: 'Module' }));

const action$a = async ({ request }) => {
  const authHeader = request.headers.get("authorization");
  const key = authHeader?.slice(7);
  const hash = crypto.createHash("sha256").update(key || "").digest("hex");
  const authedShop = await prisma$1.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!authedShop) {
    return json({ error: "Invalid API key" }, { status: 401 });
  }
  const url = new URL(request.url);
  const targetShop = url.searchParams.get("shop") || authedShop.shop;
  const deleted = await prisma$1.session.deleteMany({
    where: { shop: targetShop, isOnline: false }
  });
  return json({
    ok: true,
    shop: targetShop,
    deletedSessions: deleted.count,
    message: "Old session deleted. The app will re-authenticate on next visit. Go to the app in Shopify admin to fix the token."
  });
};

const route1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$a
}, Symbol.toStringTag, { value: 'Module' }));

const loader$e = async ({ request }) => {
  const authHeader = request.headers.get("authorization");
  const key = authHeader?.slice(7);
  const hash = crypto.createHash("sha256").update(key || "").digest("hex");
  const authedShop = await prisma$1.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!authedShop) {
    return json({ error: "Invalid API key" }, { status: 401 });
  }
  const url = new URL(request.url);
  const targetShop = url.searchParams.get("shop") || authedShop.shop;
  const sessions = await prisma$1.session.findMany({
    where: { shop: targetShop },
    select: { id: true, isOnline: true, accessToken: true, scope: true, expires: true }
  });
  return json({
    shop: targetShop,
    sessions: sessions.map((s) => ({
      id: s.id,
      isOnline: s.isOnline,
      hasToken: !!s.accessToken,
      tokenPrefix: s.accessToken ? s.accessToken.substring(0, 8) + "..." : null,
      scope: s.scope,
      expires: s.expires
    }))
  });
};

const route2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  loader: loader$e
}, Symbol.toStringTag, { value: 'Module' }));

const loader$d = async ({ request }) => {
  return json({ message: "Send POST to upgrade" });
};
const action$9 = async ({ request }) => {
  const authHeader = request.headers.get("authorization");
  const key = authHeader?.slice(7);
  const hash = crypto.createHash("sha256").update(key || "").digest("hex");
  const authedShop = await prisma$1.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!authedShop) {
    return json({ error: "Invalid API key" }, { status: 401 });
  }
  const url = new URL(request.url);
  const targetShop = url.searchParams.get("shop") || authedShop.shop;
  await prisma$1.shop.upsert({
    where: { shop: targetShop },
    update: { planName: "pro" },
    create: { id: targetShop, shop: targetShop, planName: "pro" }
  });
  return json({ ok: true, shop: targetShop, plan: "pro", upgradedBy: authedShop.shop });
};

const route3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$9,
  loader: loader$d
}, Symbol.toStringTag, { value: 'Module' }));

const DEFAULT_FRAUD_RULES = {
  maxReturnsPerCustomer: 3,
  maxReturnsWindowDays: 30,
  maxValuePerReturn: 5e3,
  blockedCountries: [],
  suspiciousEmailDomains: [
    "mailinator.com",
    "guerrillamail.com",
    "10minutemail.com",
    "tempmail.com",
    "throwaway.email",
    "sharklasers.com",
    "yopmail.com",
    "trashmail.com"
  ],
  enabled: true
};
const COMMON_COUNTRY_NAMES = {
  "US": "US",
  "USA": "US",
  "UNITED STATES": "US",
  "AMERICA": "US",
  "GB": "GB",
  "UK": "GB",
  "UNITED KINGDOM": "GB",
  "CA": "CA",
  "CANADA": "CA",
  "AU": "AU",
  "AUSTRALIA": "AU",
  "DE": "DE",
  "GERMANY": "DE",
  "FR": "FR",
  "FRANCE": "FR",
  "NL": "NL",
  "NETHERLANDS": "NL",
  "RU": "RU",
  "RUSSIA": "RU",
  "RUSSIAN FEDERATION": "RU",
  "CN": "CN",
  "CHINA": "CN",
  "IN": "IN",
  "INDIA": "IN"
};
function normalizeCountry(country) {
  const upper = country.trim().toUpperCase();
  return COMMON_COUNTRY_NAMES[upper] || upper;
}
function extractEmailDomain(email) {
  const atIndex = email.indexOf("@");
  if (atIndex === -1) return null;
  return email.slice(atIndex + 1).toLowerCase().trim();
}
function loadFraudRules(shopConfig) {
  const raw = shopConfig?.fraudRules;
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_FRAUD_RULES };
  }
  return {
    maxReturnsPerCustomer: typeof raw.maxReturnsPerCustomer === "number" && raw.maxReturnsPerCustomer > 0 ? raw.maxReturnsPerCustomer : DEFAULT_FRAUD_RULES.maxReturnsPerCustomer,
    maxReturnsWindowDays: typeof raw.maxReturnsWindowDays === "number" && raw.maxReturnsWindowDays > 0 ? raw.maxReturnsWindowDays : DEFAULT_FRAUD_RULES.maxReturnsWindowDays,
    maxValuePerReturn: typeof raw.maxValuePerReturn === "number" && raw.maxValuePerReturn > 0 ? raw.maxValuePerReturn : DEFAULT_FRAUD_RULES.maxValuePerReturn,
    blockedCountries: Array.isArray(raw.blockedCountries) ? raw.blockedCountries : DEFAULT_FRAUD_RULES.blockedCountries,
    suspiciousEmailDomains: Array.isArray(raw.suspiciousEmailDomains) ? raw.suspiciousEmailDomains : DEFAULT_FRAUD_RULES.suspiciousEmailDomains,
    enabled: raw.enabled !== false
  };
}
function validateFraudRules(raw) {
  const errors = [];
  if (raw.maxReturnsPerCustomer !== void 0 && (typeof raw.maxReturnsPerCustomer !== "number" || raw.maxReturnsPerCustomer < 1)) {
    errors.push("Max returns per customer must be a positive number");
  }
  if (raw.maxReturnsWindowDays !== void 0 && (typeof raw.maxReturnsWindowDays !== "number" || raw.maxReturnsWindowDays < 1)) {
    errors.push("Returns window must be a positive number of days");
  }
  if (raw.maxValuePerReturn !== void 0 && (typeof raw.maxValuePerReturn !== "number" || raw.maxValuePerReturn < 0)) {
    errors.push("Max value per return must be a non-negative number");
  }
  if (raw.blockedCountries !== void 0 && !Array.isArray(raw.blockedCountries)) {
    errors.push("Blocked countries must be a list");
  }
  if (raw.suspiciousEmailDomains !== void 0 && !Array.isArray(raw.suspiciousEmailDomains)) {
    errors.push("Suspicious email domains must be a list");
  }
  return errors;
}
function evaluateFraudRules(params, rules, recentReturnCount) {
  if (!rules.enabled) {
    return { passed: true, triggeredRules: [], maxScore: 0 };
  }
  const triggered = [];
  if (params.totalAmount > rules.maxValuePerReturn) {
    triggered.push({
      triggered: true,
      rule: "max_value_per_return",
      details: `Return value $${params.totalAmount.toFixed(2)} exceeds max $${rules.maxValuePerReturn.toFixed(2)}`,
      score: 0.6
    });
  }
  if (recentReturnCount !== null && recentReturnCount >= rules.maxReturnsPerCustomer) {
    triggered.push({
      triggered: true,
      rule: "max_returns_per_customer",
      details: `Customer has ${recentReturnCount} returns in last ${rules.maxReturnsWindowDays} days (max ${rules.maxReturnsPerCustomer})`,
      score: 0.7
    });
  }
  if (params.customerEmail && rules.suspiciousEmailDomains.length > 0) {
    const domain = extractEmailDomain(params.customerEmail);
    if (domain && rules.suspiciousEmailDomains.includes(domain)) {
      triggered.push({
        triggered: true,
        rule: "suspicious_email_domain",
        details: `Email domain "${domain}" is flagged as suspicious`,
        score: 0.8
      });
    }
  }
  if (params.customerCountry && rules.blockedCountries.length > 0) {
    const normalized = normalizeCountry(params.customerCountry);
    if (rules.blockedCountries.includes(normalized)) {
      triggered.push({
        triggered: true,
        rule: "blocked_country",
        details: `Country "${params.customerCountry}" is blocked`,
        score: 1
      });
    }
  }
  const maxScore = triggered.length > 0 ? Math.max(...triggered.map((t) => t.score)) : 0;
  return {
    passed: triggered.length === 0,
    triggeredRules: triggered,
    maxScore
  };
}

const loader$c = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = await prisma$1.shop.findUnique({ where: { shop: session.shop } });
  const config = shop?.config || {};
  const rules = {
    maxReturnsPerCustomer: config.fraudRules?.maxReturnsPerCustomer ?? DEFAULT_FRAUD_RULES.maxReturnsPerCustomer,
    maxReturnsWindowDays: config.fraudRules?.maxReturnsWindowDays ?? DEFAULT_FRAUD_RULES.maxReturnsWindowDays,
    maxValuePerReturn: config.fraudRules?.maxValuePerReturn ?? DEFAULT_FRAUD_RULES.maxValuePerReturn,
    blockedCountries: config.fraudRules?.blockedCountries ?? DEFAULT_FRAUD_RULES.blockedCountries,
    suspiciousEmailDomains: config.fraudRules?.suspiciousEmailDomains ?? DEFAULT_FRAUD_RULES.suspiciousEmailDomains,
    enabled: config.fraudRules?.enabled !== false
  };
  return json({ rules });
};
const action$8 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const formData = await request.formData();
  const _action = formData.get("_action");
  if (_action === "save_rules") {
    const raw = {};
    const maxReturns = parseInt(formData.get("maxReturnsPerCustomer"), 10);
    const windowDays = parseInt(formData.get("maxReturnsWindowDays"), 10);
    const maxValue = parseFloat(formData.get("maxValuePerReturn"));
    raw.maxReturnsPerCustomer = isNaN(maxReturns) ? DEFAULT_FRAUD_RULES.maxReturnsPerCustomer : maxReturns;
    raw.maxReturnsWindowDays = isNaN(windowDays) ? DEFAULT_FRAUD_RULES.maxReturnsWindowDays : windowDays;
    raw.maxValuePerReturn = isNaN(maxValue) ? DEFAULT_FRAUD_RULES.maxValuePerReturn : maxValue;
    const countriesRaw = (formData.get("blockedCountries") || "").trim();
    raw.blockedCountries = countriesRaw ? countriesRaw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
    const domainsRaw = (formData.get("suspiciousEmailDomains") || "").trim();
    raw.suspiciousEmailDomains = domainsRaw ? domainsRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
    raw.enabled = formData.get("enabled") === "true";
    const errors = validateFraudRules(raw);
    if (errors.length > 0) {
      return json({ error: errors.join("; ") }, { status: 400 });
    }
    const shopRec = await prisma$1.shop.findUnique({ where: { shop: session.shop } });
    const currentConfig = shopRec?.config || {};
    await prisma$1.shop.update({
      where: { shop: session.shop },
      data: {
        config: {
          ...currentConfig,
          fraudRules: raw
        }
      }
    });
    return json({ saved: true });
  }
  if (_action === "reset_defaults") {
    const shopRec = await prisma$1.shop.findUnique({ where: { shop: session.shop } });
    const currentConfig = shopRec?.config || {};
    const { fraudRules: _, ...rest } = currentConfig;
    await prisma$1.shop.update({
      where: { shop: session.shop },
      data: { config: rest }
    });
    return json({ reset: true });
  }
  return json({ ok: true });
};
function countriesList(rules) {
  return (rules.blockedCountries || []).join(", ");
}
function domainsList(rules) {
  return (rules.suspiciousEmailDomains || []).join(", ");
}
function FraudRulesPage() {
  const { rules: initialRules } = useLoaderData();
  const fetcher = useFetcher();
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
  const countryTags = countries ? countries.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const domainTags = domains ? domains.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const addCountryTag = useCallback(() => {
    const val = countryInput.trim().toUpperCase();
    if (!val) return;
    const existing = countries ? countries.split(",").map((s) => s.trim().toUpperCase()) : [];
    if (existing.includes(val)) return;
    const next = [...existing, val].join(", ");
    setCountries(next);
    setCountryInput("");
  }, [countryInput, countries]);
  const removeCountryTag = useCallback((tag) => {
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
  const removeDomainTag = useCallback((tag) => {
    const existing = domains ? domains.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const next = existing.filter((t) => t.toLowerCase() !== tag.toLowerCase()).join(", ");
    setDomains(next);
  }, [domains]);
  return /* @__PURE__ */ jsx(Page, { title: "Fraud Rules", children: /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsxs(Layout.Section, { children: [
    saved && /* @__PURE__ */ jsx(Banner, { tone: "success", children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Fraud rules saved successfully!" }) }),
    reset && /* @__PURE__ */ jsx(Banner, { tone: "success", children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Fraud rules reset to defaults." }) }),
    error && /* @__PURE__ */ jsx(Banner, { tone: "critical", children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: error }) }),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
      /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Custom Fraud Rules" }),
      /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", tone: "subdued", children: "Configure advanced fraud detection rules for the AI agent. These rules are evaluated alongside built-in checks when the agent analyzes a return request. Rules that trigger will increase the risk score and may flag the return for manual review." }),
      /* @__PURE__ */ jsxs(fetcher.Form, { method: "post", children: [
        /* @__PURE__ */ jsx("input", { type: "hidden", name: "_action", value: "save_rules" }),
        /* @__PURE__ */ jsx("input", { type: "hidden", name: "enabled", value: String(enabled) }),
        /* @__PURE__ */ jsx("input", { type: "hidden", name: "blockedCountries", value: countries }),
        /* @__PURE__ */ jsx("input", { type: "hidden", name: "suspiciousEmailDomains", value: domains }),
        /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
          /* @__PURE__ */ jsx(
            Checkbox,
            {
              label: "Enable custom fraud rules",
              checked: enabled,
              onChange: (v) => setEnabled(v)
            }
          ),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingSm", as: "h3", fontWeight: "semibold", children: "Max Returns Per Customer" }),
            /* @__PURE__ */ jsxs(InlineStack, { gap: "200", wrap: false, children: [
              /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: /* @__PURE__ */ jsx(
                TextField,
                {
                  label: "Max returns",
                  type: "number",
                  name: "maxReturnsPerCustomer",
                  value: maxReturns,
                  onChange: setMaxReturns,
                  autoComplete: "off",
                  placeholder: "3"
                }
              ) }),
              /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: /* @__PURE__ */ jsx(
                TextField,
                {
                  label: "Within (days)",
                  type: "number",
                  name: "maxReturnsWindowDays",
                  value: windowDays,
                  onChange: setWindowDays,
                  autoComplete: "off",
                  placeholder: "30"
                }
              ) })
            ] }),
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "p", tone: "subdued", children: "Flags a customer who exceeds this many return requests within the given window." })
          ] }),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingSm", as: "h3", fontWeight: "semibold", children: "Max Value Per Return" }),
            /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Maximum return value ($)",
                type: "number",
                name: "maxValuePerReturn",
                value: maxValue,
                onChange: setMaxValue,
                autoComplete: "off",
                prefix: "$",
                placeholder: "5000"
              }
            ),
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "p", tone: "subdued", children: "Flags a return whose total item value exceeds this amount." })
          ] }),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingSm", as: "h3", fontWeight: "semibold", children: "Blocked Countries" }),
            /* @__PURE__ */ jsx(InlineStack, { gap: "200", wrap: false, children: /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Add country code",
                value: countryInput,
                onChange: setCountryInput,
                placeholder: "e.g. RU",
                autoComplete: "off",
                connectedRight: /* @__PURE__ */ jsx(Button, { onClick: addCountryTag, children: "Add" })
              }
            ) }) }),
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "p", tone: "subdued", children: "Use ISO 3166-1 alpha-2 country codes (e.g. RU, KP, IR). Returns from blocked countries receive the highest risk score." }),
            countryTags.length > 0 && /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
              /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "p", tone: "subdued", children: "Blocked countries:" }),
              /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 4 }, children: countryTags.map((tag) => /* @__PURE__ */ jsx(Tag, { onRemove: () => removeCountryTag(tag), children: tag }, tag)) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingSm", as: "h3", fontWeight: "semibold", children: "Suspicious Email Domains" }),
            /* @__PURE__ */ jsx(InlineStack, { gap: "200", wrap: false, children: /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Add domain",
                value: domainInput,
                onChange: setDomainInput,
                placeholder: "e.g. tempmail.com",
                autoComplete: "off",
                connectedRight: /* @__PURE__ */ jsx(Button, { onClick: addDomainTag, children: "Add" })
              }
            ) }) }),
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "p", tone: "subdued", children: "Disposable or temporary email domains. Returns using these domains get a high risk score." }),
            domainTags.length > 0 && /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
              /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "p", tone: "subdued", children: "Flagged domains:" }),
              /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 4 }, children: domainTags.map((tag) => /* @__PURE__ */ jsx(Tag, { onRemove: () => removeDomainTag(tag), children: tag }, tag)) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs(InlineStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Button, { submit: true, variant: "primary", loading: isSaving, disabled: isSaving, children: "Save Rules" }),
            /* @__PURE__ */ jsx(
              Button,
              {
                variant: "secondary",
                onClick: () => {
                  if (window.confirm("Reset all fraud rules to defaults? This cannot be undone.")) {
                    fetcher.submit({ _action: "reset_defaults" }, { method: "post" });
                  }
                },
                children: "Reset to Defaults"
              }
            )
          ] })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
      /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "How Fraud Rules Work" }),
      /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "p", children: [
        "When the AI agent runs ",
        /* @__PURE__ */ jsx("code", { children: "check_fraud" }),
        " on a return request, these custom rules are evaluated alongside the built-in checks (high-value anomaly, frequent returner pattern)."
      ] }),
      /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Each rule contributes a risk score (0–1). The highest score among all triggered rules determines the overall risk level:" }),
      /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
        /* @__PURE__ */ jsxs(Text, { variant: "bodySm", as: "p", children: [
          /* @__PURE__ */ jsx("strong", { children: "≤ 0.2" }),
          " → Low risk (auto-approved by default)"
        ] }),
        /* @__PURE__ */ jsxs(Text, { variant: "bodySm", as: "p", children: [
          /* @__PURE__ */ jsx("strong", { children: "0.2 – 0.5" }),
          " → Medium risk (flagged for review)"
        ] }),
        /* @__PURE__ */ jsxs(Text, { variant: "bodySm", as: "p", children: [
          /* @__PURE__ */ jsx("strong", { children: "> 0.5" }),
          " → High risk (flagged for review)"
        ] })
      ] }),
      /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "p", tone: "subdued", children: "Default blocked countries and suspicious domains are pre-populated when no custom configuration exists. Customizing overrides the defaults." })
    ] }) })
  ] }) }) });
}

const route4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$8,
  default: FraudRulesPage,
  loader: loader$c
}, Symbol.toStringTag, { value: 'Module' }));

const STATUS_COLORS$2 = {
  PENDING: "warning",
  APPROVED: "success",
  DENIED: "critical",
  EXCHANGE: "info",
  SHIPPED: "info",
  REFUNDED: "success",
  CLOSED: "new"
};
const loader$b = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || void 0;
  const where = { shop: session.shop };
  if (status) where.status = status;
  const returns = await prisma$1.returnRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50
  });
  const counts = await prisma$1.returnRequest.groupBy({
    by: ["status"],
    where: { shop: session.shop },
    _count: true
  });
  const countMap = {};
  counts.forEach((c) => {
    countMap[c.status] = c._count;
  });
  return json({ returns, counts: countMap, currentStatus: status || "all" });
};
function statusBadge$2(status) {
  return {
    children: status.charAt(0) + status.slice(1).toLowerCase(),
    tone: STATUS_COLORS$2[status] || "info"
  };
}
function ReturnsPage() {
  const { returns, counts, currentStatus } = useLoaderData();
  const resourceName = { singular: "return", plural: "returns" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(returns);
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const rowMarkup = returns.map(
    ({ id, orderName, customerName, status, createdAt }, index) => {
      const badge = statusBadge$2(status);
      return /* @__PURE__ */ jsxs(
        IndexTable.Row,
        {
          id,
          selected: selectedResources.includes(id),
          position: index,
          children: [
            /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Link$1, { url: `/returns/${id}`, children: orderName || "—" }) }),
            /* @__PURE__ */ jsx(IndexTable.Cell, { children: customerName || "—" }),
            /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Badge, { tone: badge.tone, children: badge.children }) }),
            /* @__PURE__ */ jsx(IndexTable.Cell, { children: new Date(createdAt).toLocaleDateString() })
          ]
        },
        id
      );
    }
  );
  return /* @__PURE__ */ jsx(Page, { title: "Returns", children: /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
    /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }, children: [
      { label: "All", count: totalCount, key: "all", color: "#5c6ac4" },
      { label: "Pending", count: counts.PENDING || 0, key: "PENDING", color: "#ecc134" },
      { label: "Approved", count: counts.APPROVED || 0, key: "APPROVED", color: "#50b83c" },
      { label: "Denied", count: counts.DENIED || 0, key: "DENIED", color: "#de3617" },
      { label: "Refunded", count: counts.REFUNDED || 0, key: "REFUNDED", color: "#47c1bf" }
    ].map(({ label, count, key, color }) => /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          cursor: "pointer",
          borderLeft: `3px solid ${color}`,
          paddingLeft: 8,
          opacity: currentStatus === key ? 1 : 0.7
        },
        onClick: () => {
          const params = new URLSearchParams(window.location.search);
          if (key === "all") params.delete("status");
          else params.set("status", key);
          window.location.search = params.toString();
        },
        children: [
          /* @__PURE__ */ jsx(Text, { variant: "headingXl", as: "p", fontWeight: "bold", children: count }),
          /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "subdued", children: label })
        ]
      }
    ) }, key)) }),
    /* @__PURE__ */ jsx(Card, { children: returns.length === 0 ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        heading: "No returns yet",
        image: "",
        children: /* @__PURE__ */ jsx("p", { children: "Returns will appear here when customers submit them or when orders are fulfilled." })
      }
    ) : /* @__PURE__ */ jsx(
      IndexTable,
      {
        resourceName,
        itemCount: returns.length,
        selectedItemsCount: allResourcesSelected ? "All" : selectedResources.length,
        onSelectionChange: handleSelectionChange,
        headings: [
          { title: "Order" },
          { title: "Customer" },
          { title: "Status" },
          { title: "Date" }
        ],
        children: rowMarkup
      }
    ) })
  ] }) }) }) });
}

const route5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: ReturnsPage,
  loader: loader$b
}, Symbol.toStringTag, { value: 'Module' }));

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-10";
async function shopifyAdminQuery(shop, accessToken, query, variables, idempotencyKey) {
  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": accessToken
  };
  if (idempotencyKey) {
    headers["X-Shopify-Idempotency-Key"] = idempotencyKey;
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables })
  });
  if (response.status === 401) {
    const refreshed = await tryRefreshToken(shop);
    if (refreshed) {
      const retryResp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": refreshed
        },
        body: JSON.stringify({ query, variables })
      });
      return retryResp.json();
    }
    throw new Error(`Shopify API token expired and refresh failed for ${shop}`);
  }
  return response.json();
}
async function tryRefreshToken(shop) {
  const session = await prisma$1.session.findFirst({
    where: { shop, isOnline: false }
  });
  if (!session?.refreshToken || !session?.accessToken) {
    console.log(`[shopify] No refresh token available for ${shop}`);
    return null;
  }
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiKey || !apiSecret) {
    console.log(`[shopify] Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET`);
    return null;
  }
  try {
    const response = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        },
        body: new URLSearchParams({
          client_id: apiKey,
          client_secret: apiSecret,
          grant_type: "refresh_token",
          refresh_token: session.refreshToken
        }).toString()
      }
    );
    if (!response.ok) {
      const text = await response.text();
      console.log(`[shopify] Token refresh failed for ${shop}: ${text}`);
      return null;
    }
    const data = await response.json();
    await prisma$1.session.update({
      where: { id: session.id },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || session.refreshToken,
        expires: data.expires_in ? new Date(Date.now() + data.expires_in * 1e3) : void 0
      }
    });
    console.log(`[shopify] Token refreshed successfully for ${shop}`);
    return data.access_token;
  } catch (err) {
    console.log(`[shopify] Token refresh error for ${shop}: ${err.message}`);
    return null;
  }
}
async function executeRefund(shop, accessToken, orderId, amount, restock = true, reason = "Customer return") {
  const orderGid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;
  const orderQuery = `{
    order(id: "${orderGid}") {
      id
      transactions(first: 5) { edges { node { id amountSet { shopMoney { amount } } kind } } }
      lineItems(first: 20) { edges { node { id quantity } } }
    }
  }`;
  const orderResult = await shopifyAdminQuery(shop, accessToken, orderQuery);
  const order = orderResult?.data?.order;
  if (!order) {
    console.error("[refund] Order lookup failed:", JSON.stringify(orderResult?.errors || orderResult));
    const directRefundQuery = `mutation refundCreate($input: RefundInput!) @idempotent {
      refundCreate(input: $input) {
        refund { id transactions(first: 10) { nodes { id status } } }
        userErrors { field message }
      }
    }`;
    const fallbackKey = `${orderId}-${Date.now()}-fallback`;
    const directResult = await shopifyAdminQuery(shop, accessToken, directRefundQuery, {
      input: {
        orderId: orderGid,
        refundLineItems: [],
        note: reason,
        transactions: [{
          amount: amount.toString(),
          gateway: "manual",
          kind: "REFUND",
          orderId: orderGid
        }]
      }
    }, fallbackKey);
    if (directResult?.errors?.length) {
      throw new Error(`Refund GraphQL error: ${directResult.errors.map((e) => e.message).join(", ")}`);
    }
    const directErrors = directResult?.data?.refundCreate?.userErrors;
    if (directErrors?.length > 0) {
      throw new Error(`Refund failed: ${directErrors.map((e) => e.message).join(", ")}`);
    }
    return directResult?.data?.refundCreate?.refund;
  }
  const paymentTx = order.transactions?.edges?.find(
    (e) => e.node.kind === "CAPTURE" || e.node.kind === "SALE" || e.node.kind === "AUTHORIZATION"
  )?.node;
  const refundLineItems = order.lineItems?.edges?.map((e) => ({
    lineItemId: e.node.id,
    quantity: e.node.quantity,
    restockType: restock ? "RETURN" : "NO_RESTOCK"
  })) || [];
  const idempotencyKey = `${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const execQuery = `mutation refundCreate($input: RefundInput!) @idempotent {
    refundCreate(input: $input) {
      refund { id transactions(first: 10) { nodes { id status processedAt amountSet { shopMoney { amount } } } } }
      userErrors { field message }
    }
  }`;
  const execInput = {
    orderId: orderGid,
    refundLineItems,
    note: reason,
    transactions: paymentTx ? [{
      parentId: paymentTx.id,
      amount: amount.toString(),
      gateway: "shopify",
      kind: "REFUND"
    }] : [{
      amount: amount.toString(),
      gateway: "shopify",
      kind: "REFUND"
    }]
  };
  const execResult = await shopifyAdminQuery(shop, accessToken, execQuery, { input: execInput }, idempotencyKey);
  if (execResult?.errors?.length) {
    throw new Error(`Refund GraphQL error: ${execResult.errors.map((e) => e.message).join(", ")}`);
  }
  const execErrors = execResult?.data?.refundCreate?.userErrors;
  if (execErrors?.length > 0) {
    throw new Error(`Refund execution failed: ${execErrors.map((e) => e.message).join(", ")}`);
  }
  return execResult?.data?.refundCreate?.refund;
}
async function createDraftOrder$1(shop, accessToken, lineItems, customerEmail, note) {
  const mutation = `mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id name invoiceUrl }
      userErrors { field message }
    }
  }`;
  const variables = {
    input: {
      lineItems: lineItems.map((li) => ({
        variantId: li.variantId,
        quantity: li.quantity,
        appliedDiscount: { value: 100, valueType: "percentage", title: "Exchange - no charge" }
      })),
      note: note || "Exchange replacement order",
      useCustomerDefaultAddress: true
    }
  };
  if (customerEmail) {
    variables.input.email = customerEmail;
    variables.input.sendInvoice = true;
  }
  const result = await shopifyAdminQuery(shop, accessToken, mutation, variables);
  const errors = result?.data?.draftOrderCreate?.userErrors;
  if (errors?.length > 0) {
    return { draftOrderId: null, error: errors.map((e) => e.message).join(", ") };
  }
  const draftOrder = result?.data?.draftOrderCreate?.draftOrder;
  if (!draftOrder?.id) {
    return { draftOrderId: null, error: "Failed to create draft order" };
  }
  return { draftOrderId: draftOrder.id };
}
async function createStoreCredit(shop, accessToken, amount, customerEmail, reason) {
  const code = `STORE-CREDIT-${Date.now().toString(36).toUpperCase()}`;
  const mutation = `mutation discountCodeBasicCreate($input: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $input) {
      codeDiscountNode {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            codes(first: 1) {
              edges {
                node { code }
              }
            }
          }
        }
      }
      userErrors { field message }
    }
  }`;
  const variables = {
    input: {
      title: `Store Credit - ${reason}`,
      code,
      startsAt: (/* @__PURE__ */ new Date()).toISOString(),
      endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString(),
      customerSelection: {
        customers: [{ email: customerEmail }]
      },
      appliesOncePerCustomer: true,
      usageLimit: 1,
      discountType: "FIXED_AMOUNT",
      discountValue: { amount },
      appliesOn: { all: true }
    }
  };
  const result = await shopifyAdminQuery(shop, accessToken, mutation, variables);
  const errors = result?.data?.discountCodeBasicCreate?.userErrors;
  if (errors?.length > 0) {
    return { discountCode: "", discountId: null, error: errors.map((e) => e.message).join(", ") };
  }
  const discountNode = result?.data?.discountCodeBasicCreate?.codeDiscountNode;
  const discountCode = discountNode?.codeDiscount?.codes?.edges?.[0]?.node?.code || code;
  return { discountCode, discountId: discountNode?.id || null };
}

const STATUS_COLORS$1 = {
  PENDING: "warning",
  APPROVED: "success",
  DENIED: "critical",
  EXCHANGE: "info",
  SHIPPED: "info",
  REFUNDED: "success",
  CLOSED: "new"
};
const loader$a = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const exchanges = await prisma$1.returnRequest.findMany({
    where: {
      shop: session.shop,
      status: { in: ["PENDING", "EXCHANGE"] }
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  const counts = await prisma$1.returnRequest.groupBy({
    by: ["status"],
    where: { shop: session.shop, status: { in: ["PENDING", "EXCHANGE"] } },
    _count: true
  });
  const countMap = {};
  counts.forEach((c) => {
    countMap[c.status] = c._count;
  });
  return json({ exchanges, counts: countMap });
};
const action$7 = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  if (intent === "exchange") {
    const returnId = String(formData.get("returnId") || "");
    const variantId = String(formData.get("variantId") || "");
    const quantity = parseInt(String(formData.get("quantity") || "1"), 10);
    const returnReq = await prisma$1.returnRequest.findFirst({
      where: { id: returnId, shop: session.shop }
    });
    if (!returnReq) {
      return json({ ok: false, error: "Return not found" });
    }
    if (returnReq.status !== "PENDING" && returnReq.status !== "EXCHANGE") {
      return json({ ok: false, error: `Cannot exchange return in status ${returnReq.status}` });
    }
    const shopSession = await prisma$1.session.findFirst({
      where: { shop: session.shop, isOnline: false }
    });
    if (!shopSession?.accessToken) {
      return json({ ok: false, error: "No access token available" });
    }
    const draftResult = await createDraftOrder$1(
      session.shop,
      shopSession.accessToken,
      [{ variantId, quantity }],
      returnReq.customerEmail || void 0,
      `Exchange for return ${returnReq.id}`
    );
    if (draftResult.error || !draftResult.draftOrderId) {
      return json({ ok: false, error: draftResult.error || "Failed to create draft order" });
    }
    await prisma$1.returnRequest.update({
      where: { id: returnId },
      data: {
        status: "EXCHANGE",
        decidedBy: "staff",
        decidedAt: /* @__PURE__ */ new Date(),
        labels: [{
          type: "exchange_order",
          status: "created",
          draftOrderId: draftResult.draftOrderId,
          replacementVariantId: variantId,
          replacementQuantity: quantity,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }]
      }
    });
    await prisma$1.decisionLog.create({
      data: {
        returnId,
        actor: "staff",
        action: "exchange",
        details: { draftOrderId: draftResult.draftOrderId, variantId, quantity }
      }
    });
    return json({ ok: true, draftOrderId: draftResult.draftOrderId });
  }
  return json({ ok: false, error: "Unknown intent" });
};
function statusBadge$1(status) {
  return {
    children: status.charAt(0) + status.slice(1).toLowerCase(),
    tone: STATUS_COLORS$1[status] || "info"
  };
}
function ExchangesPage() {
  const { exchanges, counts } = useLoaderData();
  const fetcher = useFetcher();
  const resourceName = { singular: "exchange", plural: "exchanges" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(exchanges);
  const [activeModal, setActiveModal] = useState(null);
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const pendingCount = counts.PENDING || 0;
  const exchangeCount = counts.EXCHANGE || 0;
  const handleExchangeSubmit = (returnId) => {
    if (!variantId.trim()) return;
    const formData = new FormData();
    formData.set("intent", "exchange");
    formData.set("returnId", returnId);
    formData.set("variantId", variantId.trim());
    formData.set("quantity", quantity);
    fetcher.submit(formData, { method: "POST" });
    setActiveModal(null);
    setVariantId("");
    setQuantity("1");
  };
  const rowMarkup = exchanges.map(
    ({ id, orderName, customerName, status, createdAt, items }, index) => {
      const badge = statusBadge$1(status);
      return /* @__PURE__ */ jsxs(
        IndexTable.Row,
        {
          id,
          selected: selectedResources.includes(id),
          position: index,
          children: [
            /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Link$1, { url: `/returns/${id}`, children: orderName || "—" }) }),
            /* @__PURE__ */ jsx(IndexTable.Cell, { children: customerName || "—" }),
            /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Badge, { tone: badge.tone, children: badge.children }) }),
            /* @__PURE__ */ jsxs(IndexTable.Cell, { children: [
              items.length,
              " item",
              items.length !== 1 ? "s" : ""
            ] }),
            /* @__PURE__ */ jsx(IndexTable.Cell, { children: new Date(createdAt).toLocaleDateString() }),
            /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsxs(InlineStack, { gap: "200", children: [
              status === "PENDING" && /* @__PURE__ */ jsx(
                Button,
                {
                  size: "slim",
                  variant: "primary",
                  onClick: () => {
                    setActiveModal(id);
                    setVariantId("");
                    setQuantity("1");
                  },
                  children: "Exchange"
                }
              ),
              status === "EXCHANGE" && /* @__PURE__ */ jsx(Badge, { tone: "info", children: "Draft created" })
            ] }) })
          ]
        },
        id
      );
    }
  );
  return /* @__PURE__ */ jsxs(Page, { title: "Exchanges", children: [
    /* @__PURE__ */ jsx(TitleBar, { title: "Exchanges" }),
    /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
      /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }, children: [
        { label: "Pending Exchange", count: pendingCount, key: "PENDING", color: "#ecc134" },
        { label: "Exchanges in Progress", count: exchangeCount, key: "EXCHANGE", color: "#47c1bf" }
      ].map(({ label, count, key, color }) => /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs("div", { style: { borderLeft: `3px solid ${color}`, paddingLeft: 8 }, children: [
        /* @__PURE__ */ jsx(Text, { variant: "headingXl", as: "p", fontWeight: "bold", children: count }),
        /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "subdued", children: label })
      ] }) }, key)) }),
      fetcher.data?.ok === true && /* @__PURE__ */ jsx(Banner, { tone: "success", children: /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
        "Exchange draft order created: ",
        fetcher.data.draftOrderId
      ] }) }),
      fetcher.data?.ok === false && /* @__PURE__ */ jsx(Banner, { tone: "critical", children: /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
        "Exchange failed: ",
        fetcher.data.error
      ] }) }),
      /* @__PURE__ */ jsx(Card, { children: exchanges.length === 0 ? /* @__PURE__ */ jsx(EmptyState, { heading: "No exchanges pending", image: "", children: /* @__PURE__ */ jsx("p", { children: "Exchange requests from customers using the return portal will appear here." }) }) : /* @__PURE__ */ jsx(
        IndexTable,
        {
          resourceName,
          itemCount: exchanges.length,
          selectedItemsCount: allResourcesSelected ? "All" : selectedResources.length,
          onSelectionChange: handleSelectionChange,
          headings: [
            { title: "Order" },
            { title: "Customer" },
            { title: "Status" },
            { title: "Items" },
            { title: "Date" },
            { title: "Action" }
          ],
          children: rowMarkup
        }
      ) })
    ] }) }) }),
    activeModal && /* @__PURE__ */ jsx(
      Modal,
      {
        open: !!activeModal && fetcher.state === "idle",
        onClose: () => setActiveModal(null),
        title: "Create Exchange",
        primaryAction: {
          content: "Create Exchange Order",
          onAction: () => handleExchangeSubmit(activeModal),
          disabled: !variantId.trim()
        },
        secondaryActions: [
          { content: "Cancel", onAction: () => setActiveModal(null) }
        ],
        children: /* @__PURE__ */ jsx(Modal.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
          /* @__PURE__ */ jsx(
            TextField,
            {
              label: "Replacement Variant GID",
              value: variantId,
              onChange: setVariantId,
              placeholder: "gid://shopify/ProductVariant/123456789",
              autoComplete: "off",
              helpText: "The Shopify variant GID of the replacement item"
            }
          ),
          /* @__PURE__ */ jsx(
            Select,
            {
              label: "Quantity",
              value: quantity,
              onChange: setQuantity,
              options: [
                { label: "1", value: "1" },
                { label: "2", value: "2" },
                { label: "3", value: "3" },
                { label: "4", value: "4" },
                { label: "5", value: "5" }
              ]
            }
          )
        ] }) })
      }
    )
  ] });
}

const route6 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$7,
  default: ExchangesPage,
  loader: loader$a
}, Symbol.toStringTag, { value: 'Module' }));

const action$6 = async ({ request }) => {
  try {
    const { topic, shop, session, admin } = await shopify.authenticate.webhook(request);
    const payload = await request.json();
    console.log(`[webhook] Received ${topic} for ${shop}`);
    switch (topic) {
      case "APP_UNINSTALLED": {
        await prisma$1.shop.updateMany({
          where: { shop },
          data: { uninstalledAt: /* @__PURE__ */ new Date() }
        });
        console.log(`[webhook] Shop uninstalled: ${shop}`);
        break;
      }
      case "ORDERS_FULFILLED": {
        const orderId = payload.id;
        const orderName = payload.name || `#${orderId}`;
        const customerEmail = payload.email || payload.contact_email || "";
        const customerName = payload.customer ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim() : "";
        const lineItems = (payload.line_items || []).map((item) => ({
          variantId: `gid://shopify/ProductVariant/${item.variant_id}`,
          title: item.title,
          quantity: item.quantity,
          price: item.price || "0",
          sku: item.sku || ""
        }));
        const existing = await prisma$1.returnRequest.findFirst({
          where: { shop, orderId: `gid://shopify/Order/${orderId}` }
        });
        if (existing) {
          console.log(`[webhook] Return already exists for order ${orderName}, skipping`);
          break;
        }
        await prisma$1.returnRequest.create({
          data: {
            shop,
            orderId: `gid://shopify/Order/${orderId}`,
            orderName,
            customerEmail,
            customerName,
            items: lineItems,
            status: "PENDING"
          }
        });
        console.log(`[webhook] Created return for order ${orderName} (${lineItems.length} items)`);
        break;
      }
      case "CUSTOMERS_DATA_REQUEST":
      case "PRIVACY_REDACT": {
        console.log(`[webhook] GDPR ${topic} for ${shop}`);
        break;
      }
      default:
        console.log(`[webhook] Unhandled topic: ${topic}`);
    }
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error(`[webhook] Error:`, error.message);
    return new Response(error.message, { status: 401 });
  }
};

const route7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$6
}, Symbol.toStringTag, { value: 'Module' }));

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: 0,
    tagline: "AI-powered return management essentials.",
    features: [
      "10 returns/month",
      "Basic policy engine",
      "Customer return portal",
      "MCP read-only access",
      "Email support"
    ]
  },
  {
    key: "growth",
    name: "Growth",
    price: 9.99,
    highlight: true,
    badge: "Most popular",
    tagline: "Automate returns with AI agents.",
    features: [
      "Unlimited returns",
      "Auto-approve policies",
      "Fraud detection",
      "Full MCP access (read + write)",
      "Refund execution",
      "Email notifications",
      "Analytics dashboard",
      "7-day free trial"
    ]
  },
  {
    key: "pro",
    name: "Pro",
    price: 29,
    badge: "Best value",
    tagline: "Everything automated — labels, exchanges, SMS.",
    features: [
      "Everything in Growth",
      "Label generation (SendCloud/Shippo/EasyPost)",
      "Exchange workflow",
      "SMS alerts",
      "Advanced fraud detection",
      "Full analytics + export",
      "Priority support",
      "7-day free trial"
    ]
  }
];
const loader$9 = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma$1.shop.upsert({
    where: { shop: session.shop },
    update: {},
    create: { shop: session.shop, id: session.shop }
  });
  return { currentPlan: shop.planName, planStatus: shop.planStatus };
};
const action$5 = async ({ request }) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const planKey = String(formData.get("planKey"));
  const plan = PLANS.find((p) => p.key === planKey);
  if (!plan) return Response.json({ ok: false, error: "Unknown plan" });
  const appHandle = process.env.SHOPIFY_APP_HANDLE || "shopigent-returns";
  const shopName = session.shop.replace(/\.myshopify\.com$/, "");
  const pricingUrl = `https://admin.shopify.com/store/${shopName}/charges/${appHandle}/pricing_plans`;
  await prisma$1.shop.upsert({
    where: { shop: session.shop },
    update: { planName: planKey, planStatus: "active" },
    create: { shop: session.shop, id: session.shop, planName: planKey, planStatus: "active" }
  }).catch(() => {
  });
  return Response.json({ ok: true, redirectUrl: pricingUrl });
};
function BillingPage() {
  const { currentPlan } = useLoaderData();
  const fetcher = useFetcher();
  const choosePlan = (planKey) => fetcher.submit({ planKey }, { method: "POST" });
  if (fetcher.data?.ok === true && fetcher.data.redirectUrl) {
    window.top.location.href = fetcher.data.redirectUrl;
  }
  return /* @__PURE__ */ jsxs(Page, { children: [
    /* @__PURE__ */ jsx(TitleBar, { title: "Billing" }),
    fetcher.data?.ok === false && /* @__PURE__ */ jsx(Banner, { tone: "critical", children: /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
      "Billing error: ",
      fetcher.data.error
    ] }) }),
    /* @__PURE__ */ jsxs(BlockStack, { gap: "500", children: [
      /* @__PURE__ */ jsx(InlineGrid, { columns: { xs: 1, sm: 2, md: 3 }, gap: "400", children: PLANS.map((plan) => {
        const isCurrent = currentPlan === plan.key;
        const isPopular = plan.highlight;
        return /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", align: "space-between", children: [
          /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
            /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", blockAlign: "center", children: [
              /* @__PURE__ */ jsxs(InlineStack, { gap: "200", blockAlign: "center", children: [
                /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingLg", children: plan.name }),
                plan.badge && /* @__PURE__ */ jsx(Badge, { tone: isPopular ? "success" : "info", children: plan.badge })
              ] }),
              isCurrent && /* @__PURE__ */ jsx(Badge, { tone: "success", children: "Current" })
            ] }),
            /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodySm", tone: "subdued", children: plan.tagline }),
            /* @__PURE__ */ jsx(Box, { minHeight: "56", children: /* @__PURE__ */ jsxs(InlineStack, { gap: "100", blockAlign: "baseline", children: [
              /* @__PURE__ */ jsx(Text, { as: "p", variant: "heading2xl", children: plan.price === 0 ? "Free" : `$${plan.price}` }),
              plan.price > 0 && /* @__PURE__ */ jsx(Text, { as: "span", variant: "bodyMd", tone: "subdued", children: "/month" })
            ] }) }),
            /* @__PURE__ */ jsx(Box, { children: /* @__PURE__ */ jsx(BlockStack, { gap: "150", children: plan.features.map((f) => /* @__PURE__ */ jsx(Box, { background: "bg-surface-secondary", padding: "200", borderRadius: "200", children: /* @__PURE__ */ jsxs(InlineStack, { gap: "150", align: "start", children: [
              /* @__PURE__ */ jsx("span", { style: { color: "var(--p-color-text-success)", fontWeight: 700 }, children: "✓" }),
              /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodySm", children: f })
            ] }) }, f)) }) })
          ] }),
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "secondary",
              disabled: isCurrent,
              loading: fetcher.state !== "idle",
              onClick: () => choosePlan(plan.key),
              fullWidth: true,
              size: "large",
              children: isCurrent ? "Current plan" : plan.price === 0 ? "Get started" : "Choose plan"
            }
          )
        ] }) }, plan.key);
      }) }),
      /* @__PURE__ */ jsx(Banner, { tone: "info", children: /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", children: "Paid plans include a 7-day free trial. You can upgrade, downgrade, or cancel anytime." }) })
    ] })
  ] });
}

const route8 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$5,
  default: BillingPage,
  loader: loader$9
}, Symbol.toStringTag, { value: 'Module' }));

const STATUS_COLORS = {
  PENDING: "warning",
  APPROVED: "success",
  DENIED: "critical",
  EXCHANGE: "info",
  SHIPPED: "info",
  REFUNDED: "success",
  CLOSED: "new"
};
const loader$8 = async ({ request, params }) => {
  const { session } = await shopify.authenticate.admin(request);
  const returnReq = await prisma$1.returnRequest.findFirst({
    where: { id: params.id, shop: session.shop },
    include: {
      fraudSignals: true,
      decisionLogs: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!returnReq) throw new Response("Not found", { status: 404 });
  return json({ return: returnReq });
};
function ReturnDetailPage() {
  const { return: r } = useLoaderData();
  const items = r.items;
  const logs = r.decisionLogs;
  return /* @__PURE__ */ jsx(
    Page,
    {
      title: `Return ${r.orderName || r.id.slice(0, 8)}`,
      backAction: { url: "/returns" },
      children: /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
        /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
          /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
            /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
              /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Status" }),
              /* @__PURE__ */ jsx(Badge, { tone: STATUS_COLORS[r.status] || "info", children: r.status })
            ] }),
            r.status === "PENDING" && /* @__PURE__ */ jsxs(InlineStack, { gap: "200", children: [
              /* @__PURE__ */ jsx(Button, { tone: "critical", children: "Deny" }),
              /* @__PURE__ */ jsx(Button, { variant: "primary", tone: "success", children: "Approve" })
            ] })
          ] }),
          r.customerName && /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "p", children: [
            /* @__PURE__ */ jsx("strong", { children: "Customer:" }),
            " ",
            r.customerName,
            " ",
            r.customerEmail && `(${r.customerEmail})`
          ] }),
          r.reason && /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "p", children: [
            /* @__PURE__ */ jsx("strong", { children: "Reason:" }),
            " ",
            r.reason
          ] }),
          r.notes && /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "p", children: [
            /* @__PURE__ */ jsx("strong", { children: "Notes:" }),
            " ",
            r.notes
          ] }),
          /* @__PURE__ */ jsxs(Text, { variant: "bodySm", as: "p", tone: "subdued", children: [
            "Created: ",
            new Date(r.createdAt).toLocaleString()
          ] })
        ] }) }),
        /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
          /* @__PURE__ */ jsxs(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: [
            "Items (",
            items.length,
            ")"
          ] }),
          items.map((item, i) => /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
            /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
              /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "span", fontWeight: "bold", children: item.title }),
              /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "span", children: [
                "x",
                item.quantity,
                " ",
                item.price && `$${item.price}`
              ] })
            ] }),
            item.sku && /* @__PURE__ */ jsx(Tag, { children: item.sku }),
            item.reason && /* @__PURE__ */ jsxs(Text, { variant: "bodySm", as: "p", tone: "subdued", children: [
              "Reason: ",
              item.reason
            ] })
          ] }, i))
        ] }) }),
        r.fraudSignals.length > 0 && /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
          /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Fraud Signals" }),
          r.fraudSignals.map((s) => /* @__PURE__ */ jsxs(InlineStack, { gap: "200", children: [
            /* @__PURE__ */ jsxs(Badge, { tone: s.score > 0.5 ? "critical" : "warning", children: [
              (s.score * 100).toFixed(0),
              "%"
            ] }),
            /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "span", children: s.signal })
          ] }, s.id))
        ] }) }),
        logs.length > 0 && /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
          /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Activity Log" }),
          logs.map((log) => /* @__PURE__ */ jsx(BlockStack, { gap: "100", children: /* @__PURE__ */ jsxs(InlineStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", fontWeight: "bold", children: log.actor }),
            /* @__PURE__ */ jsx(Tag, { children: log.action }),
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "subdued", children: new Date(log.createdAt).toLocaleString() })
          ] }) }, log.id))
        ] }) })
      ] }) }) })
    }
  );
}

const route9 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: ReturnDetailPage,
  loader: loader$8
}, Symbol.toStringTag, { value: 'Module' }));

const loader$7 = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  try {
    await registerWebhooks({ session });
  } catch (error) {
    console.log(`[auth] Webhook registration: ${error}`);
  }
  return null;
};

const route10 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  loader: loader$7
}, Symbol.toStringTag, { value: 'Module' }));

const loader$6 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;
  const totalReturns = await prisma$1.returnRequest.count({ where: { shop } });
  const statusCounts = await prisma$1.returnRequest.groupBy({
    by: ["status"],
    where: { shop },
    _count: true
  });
  const statusMap = {};
  statusCounts.forEach((s) => {
    statusMap[s.status] = s._count;
  });
  const refundAgg = await prisma$1.returnRequest.aggregate({
    where: { shop, status: "REFUNDED" },
    _sum: { refundAmount: true }
  });
  const totalRefunded = refundAgg._sum.refundAmount || 0;
  const autoApproved = await prisma$1.returnRequest.count({
    where: { shop, decidedBy: "agent" }
  });
  const decidedReturns = await prisma$1.returnRequest.findMany({
    where: { shop, decidedAt: { not: null } },
    select: { createdAt: true, decidedAt: true }
  });
  let avgResolutionHours = 0;
  if (decidedReturns.length > 0) {
    const totalHours = decidedReturns.reduce((sum, r) => {
      const diff = (new Date(r.decidedAt).getTime() - new Date(r.createdAt).getTime()) / (1e3 * 60 * 60);
      return sum + diff;
    }, 0);
    avgResolutionHours = Math.round(totalHours / decidedReturns.length);
  }
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
  const recentReturns = await prisma$1.returnRequest.findMany({
    where: { shop, createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, status: true, refundAmount: true }
  });
  const dailyCounts = {};
  recentReturns.forEach((r) => {
    const day = new Date(r.createdAt).toISOString().slice(0, 10);
    if (!dailyCounts[day]) dailyCounts[day] = { total: 0, approved: 0, refunded: 0, amount: 0 };
    dailyCounts[day].total++;
    if (r.status === "APPROVED" || r.status === "REFUNDED") dailyCounts[day].approved++;
    if (r.status === "REFUNDED") {
      dailyCounts[day].refunded++;
      dailyCounts[day].amount += parseFloat(String(r.refundAmount || 0));
    }
  });
  const dailyData = Object.entries(dailyCounts).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const fraudCount = await prisma$1.fraudSignal.count({
    where: { return: { shop } }
  });
  const highRiskFraud = await prisma$1.fraudSignal.count({
    where: { return: { shop }, score: { gte: 0.5 } }
  });
  const allReturns = await prisma$1.returnRequest.findMany({
    where: { shop, reason: { not: null } },
    select: { reason: true }
  });
  const reasonCounts = {};
  allReturns.forEach((r) => {
    const reason = r.reason?.toLowerCase().trim() || "other";
    const key = reason.includes("fit") || reason.includes("size") ? "Sizing issue" : reason.includes("defect") || reason.includes("broken") || reason.includes("damage") ? "Defective" : reason.includes("color") || reason.includes("photo") || reason.includes("look") ? "Not as described" : reason.includes("change") || reason.includes("mind") ? "Changed mind" : reason.includes("quality") ? "Quality issue" : reason.includes("duplicate") ? "Duplicate order" : reason.includes("wrong") ? "Wrong item sent" : "Other";
    reasonCounts[key] = (reasonCounts[key] || 0) + 1;
  });
  const topReasons = Object.entries(reasonCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
  const items = allReturns.length > 0 ? await prisma$1.returnRequest.findMany({
    where: { shop },
    select: { items: true }
  }) : [];
  const productCounts = {};
  const productRevenue = {};
  items.forEach((r) => {
    const productItems = r.items;
    productItems.forEach((item) => {
      const title = item.title || "Unknown";
      productCounts[title] = (productCounts[title] || 0) + (item.quantity || 1);
      productRevenue[title] = (productRevenue[title] || 0) + parseFloat(item.price || "0") * (item.quantity || 1);
    });
  });
  const topProducts = Object.entries(productCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count]) => ({ name, count, revenue: productRevenue[name] || 0 }));
  return json({
    stats: {
      totalReturns,
      pending: statusMap.PENDING || 0,
      approved: statusMap.APPROVED || 0,
      denied: statusMap.DENIED || 0,
      refunded: statusMap.REFUNDED || 0,
      exchange: statusMap.EXCHANGE || 0,
      totalRefunded: Number(totalRefunded),
      autoApproved,
      autoRate: totalReturns > 0 ? Math.round(autoApproved / totalReturns * 100) : 0,
      avgResolutionHours,
      fraudCount,
      highRiskFraud
    },
    dailyData,
    topReasons: topReasons.map(([reason, count]) => ({ reason, count })),
    topProducts
  });
};
function StatCard({ label, value, tone, prefix, suffix }) {
  return /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
    /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "subdued", children: label }),
    /* @__PURE__ */ jsxs(Text, { variant: "headingXl", as: "p", fontWeight: "bold", tone, children: [
      prefix,
      typeof value === "number" ? value.toLocaleString() : value,
      suffix
    ] })
  ] }) });
}
function MiniBar({ value, max, label, color }) {
  const pct = max > 0 ? value / max * 100 : 0;
  return /* @__PURE__ */ jsxs("div", { style: { marginBottom: 8 }, children: [
    /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
      /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", children: label }),
      /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", fontWeight: "bold", children: value })
    ] }),
    /* @__PURE__ */ jsx("div", { style: {
      height: 8,
      background: "#e0e0e0",
      borderRadius: 4,
      overflow: "hidden"
    }, children: /* @__PURE__ */ jsx("div", { style: {
      width: `${pct}%`,
      height: "100%",
      background: color || "#5c6ac4",
      borderRadius: 4,
      transition: "width 0.3s"
    } }) })
  ] });
}
function AnalyticsPage() {
  const { stats, dailyData, topReasons, topProducts } = useLoaderData();
  const maxDaily = Math.max(...dailyData.map((d) => d[1].total), 1);
  return /* @__PURE__ */ jsx(Page, { title: "Analytics", subtitle: "Return performance overview", children: /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }, children: [
      /* @__PURE__ */ jsx(StatCard, { label: "Total Returns", value: stats.totalReturns }),
      /* @__PURE__ */ jsx(StatCard, { label: "Pending", value: stats.pending, tone: "warning" }),
      /* @__PURE__ */ jsx(StatCard, { label: "Approved", value: stats.approved, tone: "success" }),
      /* @__PURE__ */ jsx(StatCard, { label: "Denied", value: stats.denied, tone: "critical" }),
      /* @__PURE__ */ jsx(StatCard, { label: "Refunded", value: stats.refunded }),
      /* @__PURE__ */ jsx(StatCard, { label: "Total Refunded", value: stats.totalRefunded, prefix: "$" })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }, children: [
      /* @__PURE__ */ jsx(StatCard, { label: "Auto-Resolution Rate", value: stats.autoRate, suffix: "%", tone: stats.autoRate > 50 ? "success" : "warning" }),
      /* @__PURE__ */ jsx(StatCard, { label: "Avg Resolution Time", value: stats.avgResolutionHours, suffix: "h" }),
      /* @__PURE__ */ jsx(StatCard, { label: "Fraud Signals Detected", value: stats.fraudCount, tone: stats.fraudCount > 0 ? "warning" : void 0 }),
      /* @__PURE__ */ jsx(StatCard, { label: "High Risk Alerts", value: stats.highRiskFraud, tone: stats.highRiskFraud > 0 ? "critical" : void 0 })
    ] }),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
      /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Returns Trend (Last 14 Days)" }),
      dailyData.length === 0 ? /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", tone: "subdued", children: "No data for the last 14 days." }) : /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 4, alignItems: "flex-end", height: 120, padding: "8px 0" }, children: dailyData.map(([day, data]) => /* @__PURE__ */ jsxs("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }, children: [
        /* @__PURE__ */ jsx("div", { style: {
          width: "100%",
          maxWidth: 40,
          height: `${data.total / maxDaily * 100}%`,
          background: "#5c6ac4",
          borderRadius: "4px 4px 0 0",
          minHeight: data.total > 0 ? 4 : 0,
          position: "relative"
        }, children: data.total > 0 && /* @__PURE__ */ jsx(Text, { variant: "bodyXs", as: "span", style: {
          position: "absolute",
          top: -16,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 10
        }, children: data.total }) }),
        /* @__PURE__ */ jsx(Text, { variant: "bodyXs", as: "span", tone: "subdued", style: { fontSize: 9, marginTop: 4 }, children: day.slice(5) })
      ] }, day)) })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }, children: [
      /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Top Return Reasons" }),
        topReasons.length === 0 ? /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", tone: "subdued", children: "No data yet." }) : topReasons.map(({ reason, count }) => /* @__PURE__ */ jsx(
          MiniBar,
          {
            label: reason,
            value: count,
            max: topReasons[0]?.count || 1,
            color: "#ecc134"
          },
          reason
        ))
      ] }) }),
      /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Most Returned Products" }),
        topProducts.length === 0 ? /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", tone: "subdued", children: "No data yet." }) : topProducts.map(({ name, count, revenue }) => /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", children: name }),
            /* @__PURE__ */ jsxs(Text, { variant: "bodySm", as: "span", fontWeight: "bold", children: [
              "x",
              count
            ] })
          ] }),
          /* @__PURE__ */ jsxs(Text, { variant: "bodyXs", as: "p", tone: "subdued", children: [
            "$",
            revenue.toFixed(2),
            " returned value"
          ] })
        ] }, name))
      ] }) })
    ] })
  ] }) }) }) });
}

const route11 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: AnalyticsPage,
  loader: loader$6
}, Symbol.toStringTag, { value: 'Module' }));

function FormField({
  label,
  name,
  type,
  value,
  onChange,
  ...rest
}) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("input", { type: "hidden", name, value }),
    /* @__PURE__ */ jsx(
      TextField,
      {
        label,
        type,
        value,
        onChange,
        autoComplete: "off",
        ...rest
      }
    )
  ] });
}
const loader$5 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const policies = await prisma$1.policy.findMany({
    where: { shop: session.shop },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
  });
  return json({ policies });
};
const action$4 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const formData = await request.formData();
  const _action = formData.get("_action");
  if (_action === "create" || _action === "update") {
    const id = formData.get("id");
    const name = formData.get("name");
    const description = formData.get("description");
    const priority = parseInt(formData.get("priority")) || 0;
    const isActive = formData.get("isActive") === "true";
    const conditions = [
      { field: "maxDays", operator: "lte", value: parseInt(formData.get("maxDays")) || 30 },
      { field: "maxAmount", operator: "lte", value: parseFloat(formData.get("maxAmount")) || 9999 },
      { field: "autoApprove", operator: "eq", value: formData.get("autoApprove") === "true" },
      { field: "restockingFee", operator: "eq", value: parseFloat(formData.get("restockingFee")) || 0 },
      { field: "requiresReturnLabel", operator: "eq", value: formData.get("requiresReturnLabel") === "true" }
    ];
    if (_action === "create") {
      await prisma$1.policy.create({
        data: { shop: session.shop, name, description, priority, isActive, conditions }
      });
    } else if (id) {
      await prisma$1.policy.update({
        where: { id },
        data: { name, description, priority, isActive, conditions }
      });
    }
  } else if (_action === "delete") {
    await prisma$1.policy.delete({ where: { id: formData.get("id") } });
  } else if (_action === "toggle") {
    const id = formData.get("id");
    const policy = await prisma$1.policy.findUnique({ where: { id } });
    if (policy) {
      await prisma$1.policy.update({ where: { id }, data: { isActive: !policy.isActive } });
    }
  }
  return json({ ok: true });
};
function getCond(conditions, field) {
  return conditions.find((c) => c.field === field);
}
const emptyForm = () => ({
  name: "",
  description: "",
  priority: "0",
  maxDays: "30",
  maxAmount: "200",
  autoApprove: false,
  restockingFee: "0",
  requiresReturnLabel: false
});
function PoliciesPage() {
  const { policies } = useLoaderData();
  const fetcher = useFetcher();
  const [active, setActive] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [f, setF] = useState(emptyForm());
  const isNew = !editingId;
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      setActive(false);
      setEditingId(null);
    }
  }, [fetcher.state, fetcher.data]);
  const openNew = () => {
    setEditingId(null);
    setF(emptyForm());
    setActive(true);
  };
  const openEdit = (p) => {
    const c = p.conditions;
    setEditingId(p.id);
    setF({
      name: p.name,
      description: p.description || "",
      priority: String(p.priority),
      maxDays: String(getCond(c, "maxDays")?.value ?? 30),
      maxAmount: String(getCond(c, "maxAmount")?.value ?? 200),
      autoApprove: getCond(c, "autoApprove")?.value === true,
      restockingFee: String(getCond(c, "restockingFee")?.value ?? 0),
      requiresReturnLabel: getCond(c, "requiresReturnLabel")?.value === true
    });
    setActive(true);
  };
  const closeModal = () => {
    setActive(false);
    setEditingId(null);
  };
  const u = (field) => (val) => setF((prev) => ({ ...prev, [field]: val }));
  return /* @__PURE__ */ jsxs(
    Page,
    {
      title: "Return Policies",
      primaryAction: { content: "Add Policy", onAction: openNew },
      children: [
        /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: policies.length === 0 ? /* @__PURE__ */ jsx(Banner, { tone: "info", children: /* @__PURE__ */ jsx("p", { children: "No policies yet. Create your first return policy to start automating return decisions." }) }) : policies.map((p) => {
          const c = p.conditions;
          const autoApprove = getCond(c, "autoApprove")?.value;
          const fee = getCond(c, "restockingFee")?.value ?? 0;
          return /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", wrap: false, children: [
              /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
                /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h3", fontWeight: "bold", children: p.name }),
                p.description && /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "p", tone: "subdued", children: p.description })
              ] }),
              /* @__PURE__ */ jsxs(InlineStack, { gap: "200", align: "end", children: [
                /* @__PURE__ */ jsx(Button, { size: "slim", onClick: () => {
                  fetcher.submit({ _action: "toggle", id: p.id }, { method: "post" });
                }, children: p.isActive ? "Disable" : "Enable" }),
                /* @__PURE__ */ jsx(Button, { size: "slim", onClick: () => openEdit(p), children: "Edit" }),
                /* @__PURE__ */ jsx(Button, { size: "slim", tone: "critical", onClick: () => {
                  fetcher.submit({ _action: "delete", id: p.id }, { method: "post" });
                }, children: "Delete" })
              ] })
            ] }),
            !p.isActive && /* @__PURE__ */ jsx(Banner, { tone: "critical", children: "This policy is disabled" }),
            /* @__PURE__ */ jsxs(InlineStack, { gap: "200", wrap: true, children: [
              /* @__PURE__ */ jsxs(Tag, { tone: "info", children: [
                "Priority ",
                p.priority
              ] }),
              /* @__PURE__ */ jsxs(Tag, { tone: "info", children: [
                "≤",
                getCond(c, "maxDays")?.value ?? 30,
                " days"
              ] }),
              /* @__PURE__ */ jsxs(Tag, { tone: "info", children: [
                "≤ $",
                getCond(c, "maxAmount")?.value ?? 200
              ] }),
              autoApprove && /* @__PURE__ */ jsx(Tag, { tone: "success", children: "Auto-approve" }),
              Number(fee) > 0 && /* @__PURE__ */ jsxs(Tag, { tone: "warning", children: [
                fee,
                "% restocking fee"
              ] })
            ] })
          ] }) }, p.id);
        }) }) }),
        /* @__PURE__ */ jsx(Modal, { open: active, onClose: closeModal, title: isNew ? "Create Policy" : "Edit Policy", children: /* @__PURE__ */ jsx(Modal.Section, { children: /* @__PURE__ */ jsxs(fetcher.Form, { method: "post", id: "policy-form", children: [
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "_action", value: isNew ? "create" : "update" }),
          !isNew && /* @__PURE__ */ jsx("input", { type: "hidden", name: "id", value: editingId }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "isActive", value: "true" }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "autoApprove", value: String(f.autoApprove) }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "requiresReturnLabel", value: String(f.requiresReturnLabel) }),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
            /* @__PURE__ */ jsx(FormField, { label: "Policy Name", name: "name", value: f.name, onChange: u("name"), required: true }),
            /* @__PURE__ */ jsx(FormField, { label: "Description", name: "description", value: f.description, onChange: u("description"), multiline: 2 }),
            /* @__PURE__ */ jsx(FormField, { label: "Priority (lower = checked first)", name: "priority", type: "number", value: f.priority, onChange: u("priority") }),
            /* @__PURE__ */ jsx(FormField, { label: "Max Days for Return", name: "maxDays", type: "number", value: f.maxDays, onChange: u("maxDays") }),
            /* @__PURE__ */ jsx(FormField, { label: "Max Amount for Auto-approve ($)", name: "maxAmount", type: "number", prefix: "$", step: "0.01", value: f.maxAmount, onChange: u("maxAmount") }),
            /* @__PURE__ */ jsx(
              Checkbox,
              {
                label: "Auto-approve returns matching this policy",
                checked: f.autoApprove,
                onChange: u("autoApprove")
              }
            ),
            /* @__PURE__ */ jsx(FormField, { label: "Restocking Fee (%)", name: "restockingFee", type: "number", suffix: "%", step: "0.5", value: f.restockingFee, onChange: u("restockingFee") }),
            /* @__PURE__ */ jsx(
              Checkbox,
              {
                label: "Require return label",
                checked: f.requiresReturnLabel,
                onChange: u("requiresReturnLabel")
              }
            ),
            /* @__PURE__ */ jsx(
              Button,
              {
                onClick: () => {
                  const form = document.querySelector("#policy-form");
                  if (form) fetcher.submit(form);
                },
                variant: "primary",
                children: isNew ? "Create Policy" : "Update Policy"
              }
            )
          ] })
        ] }) }) })
      ]
    }
  );
}

const route12 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$4,
  default: PoliciesPage,
  loader: loader$5
}, Symbol.toStringTag, { value: 'Module' }));

const loader$4 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = await prisma$1.shop.findUnique({ where: { shop: session.shop } });
  const config = shop?.config || {};
  return json({
    shopDomain: session.shop,
    hasMcpKey: !!shop?.mcpApiKeyHash,
    labelConfig: {
      provider: config.labelProvider || "",
      sendcloudKey: config.sendcloudKey ? "***" : "",
      sendcloudSecret: config.sendcloudSecret ? "***" : "",
      shippoKey: config.shippoKey ? "***" : "",
      easypostKey: config.easypostKey ? "***" : ""
    }
  });
};
const action$3 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const formData = await request.formData();
  const _action = formData.get("_action");
  if (_action === "generate_key") {
    const key = "shpg_returns_" + [...Array(32)].map(() => Math.random().toString(36)[2]).join("");
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    await prisma$1.shop.upsert({
      where: { shop: session.shop },
      create: { id: session.shop, shop: session.shop, mcpApiKeyHash: hash },
      update: { mcpApiKeyHash: hash }
    });
    return json({ newKey: key });
  }
  if (_action === "save_labels") {
    const shopRec = await prisma$1.shop.findUnique({ where: { shop: session.shop } });
    const currentConfig = shopRec?.config || {};
    const provider = formData.get("provider");
    const sendcloudKey = formData.get("sendcloudKey");
    const sendcloudSecret = formData.get("sendcloudSecret");
    const shippoKey = formData.get("shippoKey");
    const easypostKey = formData.get("easypostKey");
    await prisma$1.shop.update({
      where: { shop: session.shop },
      data: {
        config: {
          ...currentConfig,
          labelProvider: provider,
          // Only update if a new value is provided (not masked "***")
          ...sendcloudKey && sendcloudKey !== "***" ? { sendcloudKey } : {},
          ...sendcloudSecret && sendcloudSecret !== "***" ? { sendcloudSecret } : {},
          ...shippoKey && shippoKey !== "***" ? { shippoKey } : {},
          ...easypostKey && easypostKey !== "***" ? { easypostKey } : {}
        }
      }
    });
    return json({ saved: true });
  }
  return json({ ok: true });
};
function SettingsPage() {
  const { shopDomain, hasMcpKey, labelConfig } = useLoaderData();
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
  return /* @__PURE__ */ jsx(Page, { title: "Settings", children: /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsxs(Layout.Section, { children: [
    saved && /* @__PURE__ */ jsx(Banner, { tone: "success", children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Label provider settings saved!" }) }),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
      /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "MCP Server" }),
      /* @__PURE__ */ jsx(Banner, { tone: "info", children: /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "p", children: [
        "Endpoint: ",
        /* @__PURE__ */ jsx("code", { children: "https://returns.greeknous.com/api/mcp" })
      ] }) }),
      newKey ? /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Banner, { tone: "critical", children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Save this key now — it will not be shown again!" }) }),
        /* @__PURE__ */ jsx("div", { style: { background: "#1a1a2e", color: "#fff", padding: 12, borderRadius: 6, fontFamily: "monospace", wordBreak: "break-all" }, children: newKey }),
        /* @__PURE__ */ jsx(Button, { onClick: () => {
          navigator.clipboard.writeText(newKey);
          setCopiedMcp(true);
        }, children: copiedMcp ? "Copied!" : "Copy to clipboard" })
      ] }) : /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: hasMcpKey ? "An MCP key exists. Generate a new one to replace it." : "No MCP key yet. Generate one for AI agent access." }),
        /* @__PURE__ */ jsx(Button, { variant: "primary", onClick: () => fetcher.submit({ _action: "generate_key" }, { method: "post" }), children: hasMcpKey ? "Regenerate Key" : "Generate MCP Key" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
      /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Return Portal" }),
      /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Give your customers a self-service return page. Add the link below to your store's navigation menu." }),
      /* @__PURE__ */ jsx(Banner, { tone: "info", children: /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "p", children: [
        "Portal URL: ",
        /* @__PURE__ */ jsxs("code", { style: { wordBreak: "break-all" }, children: [
          "https://returns.greeknous.com/return?shop=",
          shopDomain
        ] })
      ] }) }),
      /* @__PURE__ */ jsx(Button, { onClick: () => {
        navigator.clipboard.writeText(`https://returns.greeknous.com/return?shop=${shopDomain}`);
        setCopiedPortal(true);
      }, children: copiedPortal ? "Copied!" : "📋 Copy Portal Link" }),
      /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Text, { variant: "headingSm", as: "h3", fontWeight: "semibold", children: "How to add to navigation" }),
        /* @__PURE__ */ jsxs("ol", { style: { margin: 0, paddingLeft: 20, lineHeight: 1.8 }, children: [
          /* @__PURE__ */ jsxs("li", { children: [
            "Go to your Shopify Admin → ",
            /* @__PURE__ */ jsx("strong", { children: "Online Store → Navigation" })
          ] }),
          /* @__PURE__ */ jsxs("li", { children: [
            "Click ",
            /* @__PURE__ */ jsx("strong", { children: "Main menu" }),
            " (or the menu of your choice)"
          ] }),
          /* @__PURE__ */ jsxs("li", { children: [
            "Click ",
            /* @__PURE__ */ jsx("strong", { children: "Add menu item" })
          ] }),
          /* @__PURE__ */ jsxs("li", { children: [
            "Name: ",
            /* @__PURE__ */ jsx("code", { children: "Start a Return" })
          ] }),
          /* @__PURE__ */ jsx("li", { children: "Link: paste the portal URL above" }),
          /* @__PURE__ */ jsxs("li", { children: [
            "Click ",
            /* @__PURE__ */ jsx("strong", { children: "Save menu" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(Text, { variant: "bodySm", as: "p", tone: "subdued", children: [
        "Customers will verify their email with a one-time code before seeing their orders. Full guide: ",
        /* @__PURE__ */ jsx("a", { href: "https://returns-docs-production.up.railway.app/guides/return-portal", target: "_blank", rel: "noreferrer", children: "docs" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
      /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Label Provider" }),
      /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Choose your shipping provider and enter your API credentials. The AI agent will generate return labels automatically." }),
      /* @__PURE__ */ jsxs(fetcher.Form, { method: "post", children: [
        /* @__PURE__ */ jsx("input", { type: "hidden", name: "_action", value: "save_labels" }),
        /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
          /* @__PURE__ */ jsx(
            Select,
            {
              label: "Provider",
              name: "provider",
              value: provider,
              onChange: setProvider,
              options: [
                { label: "SendCloud (EU/NL — PostNL, DHL, DPD)", value: "sendcloud" },
                { label: "Shippo (US/Global — UPS, FedEx, USPS)", value: "shippo" },
                { label: "EasyPost (Global — UPS, FedEx, DHL, DPD)", value: "easypost" }
              ]
            }
          ),
          provider === "sendcloud" && /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(TextField, { label: "SendCloud API Key", name: "sendcloudKey", value: scKey, onChange: setScKey, autoComplete: "off", placeholder: scKey === "***" ? "•••••••• (saved)" : "Enter your API key" }),
            /* @__PURE__ */ jsx(TextField, { label: "SendCloud API Secret", name: "sendcloudSecret", type: "password", value: scSecret, onChange: setScSecret, autoComplete: "off", placeholder: scSecret === "***" ? "•••••••• (saved)" : "Enter your API secret" })
          ] }),
          provider === "shippo" && /* @__PURE__ */ jsx(TextField, { label: "Shippo API Key", name: "shippoKey", value: shKey, onChange: setShKey, autoComplete: "off", placeholder: shKey === "***" ? "•••••••• (saved)" : "Enter your API key" }),
          provider === "easypost" && /* @__PURE__ */ jsx(TextField, { label: "EasyPost API Key", name: "easypostKey", value: epKey, onChange: setEpKey, autoComplete: "off", placeholder: epKey === "***" ? "•••••••• (saved)" : "Enter your API key" }),
          /* @__PURE__ */ jsx(Button, { submit: true, variant: "primary", children: "Save Provider Settings" })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
      /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Email" }),
      /* @__PURE__ */ jsx(Banner, { tone: "success", children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Email notifications active via VPS mail relay. Customers receive automatic emails on approve/deny/refund." }) })
    ] }) })
  ] }) }) });
}

const route13 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$3,
  default: SettingsPage,
  loader: loader$4
}, Symbol.toStringTag, { value: 'Module' }));

const RELAY_URL = process.env.MAIL_RELAY_URL || "http://localhost:8787/send";
const RELAY_KEY = process.env.MAIL_RELAY_KEY || "";
process.env.EMAIL_FROM || "Shopigent Returns <returns@shopigent.com>";
async function sendEmail(payload) {
  if (!RELAY_KEY) {
    console.log("[email] No MAIL_RELAY_KEY configured, skipping");
    return false;
  }
  try {
    const response = await fetch(RELAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-relay-key": RELAY_KEY
      },
      body: JSON.stringify({
        to: payload.to,
        subject: payload.subject,
        text: payload.html.replace(/<[^>]*>/g, ""),
        // strip HTML for plain text fallback
        html: payload.html
      }),
      signal: AbortSignal.timeout(15e3)
    });
    if (!response.ok) {
      console.error(`[email] Relay failed: ${response.status}`);
      return false;
    }
    console.log(`[email] Sent to ${payload.to}: ${payload.subject}`);
    return true;
  } catch (err) {
    console.error(`[email] Error: ${err.message}`);
    return false;
  }
}
function returnApprovedEmail(customerName, orderName, refundAmount) {
  const refundLine = refundAmount ? `<p>Refund amount: <strong>$${refundAmount.toFixed(2)}</strong></p>` : "";
  return {
    to: "",
    subject: `Return Approved — ${orderName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#50b83c">✅ Return Approved</h2>
      <p>Hi ${customerName},</p>
      <p>Your return for order <strong>${orderName}</strong> has been approved!</p>
      ${refundLine}
      <p>Your refund will be processed within 3-5 business days.</p>
      <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
    </div>`
  };
}
function returnDeniedEmail(customerName, orderName, reason) {
  return {
    to: "",
    subject: `Return Update — ${orderName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#de3617">Return Update</h2>
      <p>Hi ${customerName},</p>
      <p>After reviewing your return request for order <strong>${orderName}</strong>, we're unable to approve it.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>If you have questions, please contact support.</p>
      <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
    </div>`
  };
}
function storeCreditProcessedEmail(customerName, orderName, amount, discountCode) {
  return {
    to: "",
    subject: `Store Credit Issued — ${orderName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#47c1bf">🎉 Store Credit Issued</h2>
      <p>Hi ${customerName},</p>
      <p>Your store credit of <strong>$${amount.toFixed(2)}</strong> for order <strong>${orderName}</strong> has been issued.</p>
      <p>Use code <strong>${discountCode}</strong> on your next purchase.</p>
      <p>The code expires in 1 year.</p>
      <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
    </div>`
  };
}
function refundProcessedEmail(customerName, orderName, amount) {
  return {
    to: "",
    subject: `Refund Processed — ${orderName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#47c1bf">💰 Refund Processed</h2>
      <p>Hi ${customerName},</p>
      <p>Your refund of <strong>$${amount.toFixed(2)}</strong> for order <strong>${orderName}</strong> has been processed.</p>
      <p>The refund will appear on your payment method within 3-5 business days.</p>
      <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
    </div>`
  };
}

async function getLabelConfig(shop) {
  const shopRec = await prisma$1.shop.findUnique({ where: { shop } });
  const dbConfig = shopRec?.config || {};
  return {
    provider: dbConfig.labelProvider || process.env.LABEL_PROVIDER || "sendcloud",
    sendcloudKey: dbConfig.sendcloudKey || process.env.SENDCLOUD_API_KEY || "",
    sendcloudSecret: dbConfig.sendcloudSecret || process.env.SENDCLOUD_API_SECRET || "",
    shippoKey: dbConfig.shippoKey || process.env.SHIPPO_API_KEY || "",
    easypostKey: dbConfig.easypostKey || process.env.EASYPOST_API_KEY || "",
    shopAddress: dbConfig.shopAddress || {
      line1: process.env.SHOP_ADDRESS_LINE1 || "",
      city: process.env.SHOP_ADDRESS_CITY || "",
      postalCode: process.env.SHOP_ADDRESS_ZIP || "",
      country: process.env.SHOP_ADDRESS_COUNTRY || "NL"
    }
  };
}
async function createReturnLabel(shop, request) {
  const config = await getLabelConfig(shop);
  switch (config.provider) {
    case "sendcloud":
      return createSendCloudLabel(request, config.sendcloudKey, config.sendcloudSecret);
    case "shippo":
      return createShippoLabel(request, config.shippoKey);
    case "easypost":
      return createEasyPostLabel(request, config.easypostKey);
    default:
      return { success: false, error: `Unknown label provider: ${config.provider}` };
  }
}
async function createSendCloudLabel(req, apiKey, apiSecret) {
  if (!apiKey || !apiSecret) {
    return { success: false, error: "SendCloud not configured (SENDCLOUD_API_KEY + SENDCLOUD_API_SECRET)" };
  }
  try {
    const response = await fetch("https://panel.sendcloud.sc/api/v2/labels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")
      },
      body: JSON.stringify({
        label: {
          order_number: req.orderName,
          order_id: req.orderName,
          name: req.customerName,
          email: req.customerEmail,
          telephone: req.customerPhone || "",
          address: req.customerAddress?.line1 || req.shopAddress.line1,
          address_2: req.customerAddress?.line2 || req.shopAddress.line2 || "",
          city: req.customerAddress?.city || req.shopAddress.city,
          postal_code: req.customerAddress?.postalCode || req.shopAddress.postalCode,
          country: req.customerAddress?.country || req.shopAddress.country,
          to_service_point: false,
          parcel_items: req.items.map((item) => ({
            description: item.title,
            quantity: item.quantity,
            weight: (req.weight || 1) / req.items.length,
            value: 0
          })),
          request_label: true,
          label_format: "pdf"
        }
      })
    });
    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `SendCloud error: ${response.status} ${err}` };
    }
    const data = await response.json();
    const label = data.label || data;
    return {
      success: true,
      labelUrl: label.label_printer_url || label.label_url,
      trackingNumber: label.tracking_number,
      labelId: String(label.id),
      cost: label.total_price ? parseFloat(label.total_price) : void 0
    };
  } catch (err) {
    return { success: false, error: `SendCloud error: ${err.message}` };
  }
}
async function createShippoLabel(req, apiKey) {
  if (!apiKey) {
    return { success: false, error: "Shippo not configured (SHIPPO_API_KEY)" };
  }
  try {
    const shipmentResp = await fetch("https://api.goshippo.com/shipments/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `ShippoToken ${apiKey}`
      },
      body: JSON.stringify({
        address_from: {
          name: "Returns",
          street1: req.shopAddress.line1,
          street2: req.shopAddress.line2 || "",
          city: req.shopAddress.city,
          state: req.shopAddress.state || "",
          zip: req.shopAddress.postalCode,
          country: req.shopAddress.country
        },
        address_to: {
          name: req.customerName,
          street1: req.customerAddress?.line1 || req.shopAddress.line1,
          street2: req.customerAddress?.line2 || "",
          city: req.customerAddress?.city || req.shopAddress.city,
          state: req.customerAddress?.state || "",
          zip: req.customerAddress?.postalCode || req.shopAddress.postalCode,
          country: req.customerAddress?.country || req.shopAddress.country
        },
        parcels: [{
          length: "30",
          width: "20",
          height: "10",
          distance_unit: "cm",
          weight: String(req.weight || 1),
          mass_unit: "kg"
        }],
        async: false
      })
    });
    if (!shipmentResp.ok) {
      return { success: false, error: `Shippo shipment failed: ${await shipmentResp.text()}` };
    }
    const shipment = await shipmentResp.json();
    if (!shipment.rates?.length) {
      return { success: false, error: "No shipping rates available" };
    }
    const rateId = shipment.rates[0].object_id;
    const labelResp = await fetch("https://api.goshippo.com/transactions/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `ShippoToken ${apiKey}`
      },
      body: JSON.stringify({
        rate: rateId,
        label_file_type: "PDF",
        async: false
      })
    });
    if (!labelResp.ok) {
      return { success: false, error: `Shippo label failed: ${await labelResp.text()}` };
    }
    const label = await labelResp.json();
    return {
      success: true,
      labelUrl: label.label_url,
      trackingNumber: label.tracking_number,
      labelId: label.object_id,
      cost: label.amount ? parseFloat(label.amount) : void 0
    };
  } catch (err) {
    return { success: false, error: `Shippo error: ${err.message}` };
  }
}
async function createEasyPostLabel(req, apiKey) {
  if (!apiKey) {
    return { success: false, error: "EasyPost not configured (EASYPOST_API_KEY)" };
  }
  try {
    const shipmentResp = await fetch("https://api.easypost.com/v2/shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        shipment: {
          from_address: {
            street1: req.shopAddress.line1,
            street2: req.shopAddress.line2 || "",
            city: req.shopAddress.city,
            state: req.shopAddress.state || "",
            zip: req.shopAddress.postalCode,
            country: req.shopAddress.country
          },
          to_address: {
            name: req.customerName,
            street1: req.customerAddress?.line1 || req.shopAddress.line1,
            street2: req.customerAddress?.line2 || "",
            city: req.customerAddress?.city || req.shopAddress.city,
            state: req.customerAddress?.state || "",
            zip: req.customerAddress?.postalCode || req.shopAddress.postalCode,
            country: req.customerAddress?.country || req.shopAddress.country
          },
          parcel: {
            length: 30,
            width: 20,
            height: 10,
            weight: req.weight || 1
          }
        }
      })
    });
    if (!shipmentResp.ok) {
      return { success: false, error: `EasyPost shipment failed: ${await shipmentResp.text()}` };
    }
    const shipment = await shipmentResp.json();
    if (!shipment.rates?.length) {
      return { success: false, error: "No shipping rates available" };
    }
    const rate = shipment.rates.sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate))[0];
    const buyResp = await fetch(`https://api.easypost.com/v2/shipments/${shipment.id}/buy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ rate: { id: rate.id } })
    });
    if (!buyResp.ok) {
      return { success: false, error: `EasyPost buy failed: ${await buyResp.text()}` };
    }
    const bought = await buyResp.json();
    return {
      success: true,
      labelUrl: bought.postage_label?.label_url,
      trackingNumber: bought.tracking_code,
      labelId: bought.id,
      cost: parseFloat(rate.rate)
    };
  } catch (err) {
    return { success: false, error: `EasyPost error: ${err.message}` };
  }
}

const TTL_MS = 5 * 60 * 1e3;
function issueConfirmationToken(secret, shop, action, returnId, args) {
  const argsHash = crypto.createHash("sha256").update(JSON.stringify(args)).digest("hex").slice(0, 16);
  const payload = {
    shop,
    action,
    returnId,
    argsHash,
    issuedAt: Date.now()
  };
  const data = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return Buffer.from(JSON.stringify({ data, signature })).toString("base64");
}
function verifyConfirmationToken(token, secret, expectedShop, expectedAction, expectedReturnId, expectedArgs) {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    const { data, signature } = decoded;
    const expectedSig = crypto.createHmac("sha256", secret).update(data).digest("hex");
    if (signature !== expectedSig) {
      return { valid: false, reason: "Invalid signature" };
    }
    const payload = JSON.parse(data);
    if (Date.now() - payload.issuedAt > TTL_MS) {
      return { valid: false, reason: "Token expired" };
    }
    if (payload.shop !== expectedShop) {
      return { valid: false, reason: "Shop mismatch" };
    }
    if (payload.action !== expectedAction) {
      return { valid: false, reason: "Action mismatch" };
    }
    if (payload.returnId !== expectedReturnId) {
      return { valid: false, reason: "Return ID mismatch" };
    }
    const cleanArgs = { ...expectedArgs };
    delete cleanArgs.confirmationToken;
    const argsHash = crypto.createHash("sha256").update(JSON.stringify(cleanArgs)).digest("hex").slice(0, 16);
    if (payload.argsHash !== argsHash) {
      return { valid: false, reason: "Arguments mismatch" };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "Invalid token format" };
  }
}
const CONFIRMATION_TOOL = {
  name: "issue_confirmation_token",
  description: "Issue a confirmation token for a destructive operation (approve/deny return). The agent must first call this tool, then include the returned token in the actual approve_return or deny_return call. Token expires in 5 minutes.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["approve_return", "deny_return"],
        description: "The action to confirm"
      },
      returnId: {
        type: "string",
        description: "The return request UUID"
      },
      args: {
        type: "object",
        description: "The arguments that will be passed to the action"
      }
    },
    required: ["action", "returnId", "args"]
  }
};

function getPlanTier(planName) {
  switch (planName) {
    case "growth":
      return "growth";
    case "pro":
      return "pro";
    default:
      return "free";
  }
}
const GROWTH_TOOLS = /* @__PURE__ */ new Set([
  "approve_return",
  "deny_return",
  "issue_confirmation_token"
]);
const PRO_TOOLS = /* @__PURE__ */ new Set([
  "exchange_return"
]);
function isToolAllowed(toolName, planTier) {
  if (PRO_TOOLS.has(toolName) && planTier !== "pro") {
    return { allowed: false, requiredPlan: "pro" };
  }
  if (GROWTH_TOOLS.has(toolName) && planTier !== "growth" && planTier !== "pro") {
    return { allowed: false, requiredPlan: "growth" };
  }
  return { allowed: true };
}

const RETURNS_TOOLS = [
  CONFIRMATION_TOOL,
  {
    name: "analyze_return",
    description: "Analyze a return request against store policies and fraud signals. Returns a recommendation (approve/deny/exchange) with confidence score.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" }
      },
      required: ["returnId"]
    }
  },
  {
    name: "approve_return",
    description: "Approve a pending return request. Optionally set refund amount, issue a return label, specify which items to refund, or issue store credit instead of a refund.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" },
        refundAmount: { type: "number", description: "Optional override refund amount" },
        issueLabel: { type: "boolean", description: "Whether to generate a return label" },
        notes: { type: "string", description: "Notes about the decision" },
        returnedItems: { type: "array", items: { type: "string" }, description: "Optional list of item IDs to refund. If omitted, all items are refunded." },
        storeCredit: { type: "boolean", description: "If true, issue a store credit discount code instead of processing a refund" }
      },
      required: ["returnId"]
    }
  },
  {
    name: "deny_return",
    description: "Deny a pending return request with a reason.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" },
        reason: { type: "string", description: "Reason for denial" }
      },
      required: ["returnId", "reason"]
    }
  },
  {
    name: "check_fraud",
    description: "Run fraud detection signals on a return request. Checks IP velocity, history patterns, amount anomalies, and custom merchant-configured fraud rules (blocked countries, max value, max returns, suspicious email domains).",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" },
        customerCountry: { type: "string", description: "Optional ISO 3166-1 alpha-2 country code of the customer (e.g. 'US', 'RU'). Used for blocked-country rule evaluation." }
      },
      required: ["returnId"]
    }
  },
  {
    name: "list_policies",
    description: "List all active return policies for the store.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_policy_recommendation",
    description: "Get a policy-based recommendation for a return request. Evaluates against all active policies and returns the best match.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" }
      },
      required: ["returnId"]
    }
  },
  {
    name: "list_returns",
    description: "List return requests, optionally filtered by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: PENDING, APPROVED, DENIED, EXCHANGE, SHIPPED, REFUNDED, CLOSED" },
        limit: { type: "number", description: "Max results (default 10)" }
      }
    }
  },
  {
    name: "exchange_return",
    description: "Create an exchange order for a pending/exchange return. Marks the return as EXCHANGE and creates a draft order with a replacement item at no charge. Requires Pro plan.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" },
        replacementVariantId: { type: "string", description: "Shopify variant GID of the replacement item (e.g. gid://shopify/ProductVariant/123)" },
        replacementQuantity: { type: "number", description: "Quantity of the replacement item (default 1)" },
        notes: { type: "string", description: "Internal notes about the exchange" }
      },
      required: ["returnId", "replacementVariantId"]
    }
  }
];

function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function jsonRpcToolResult(id, data) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } };
}
async function handleMcpRequest(body, shop) {
  const { method, id, params } = body;
  switch (method) {
    case "initialize":
      return jsonRpcResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "shopigent-returns", version: "0.1.0" }
      });
    case "tools/list":
      return jsonRpcResult(id, { tools: RETURNS_TOOLS });
    case "tools/call": {
      const toolName = params?.name;
      const args = params?.arguments || {};
      if (shop) {
        const shopRec = await prisma$1.shop.findUnique({ where: { shop } });
        const planTier = getPlanTier(shopRec?.planName);
        const { allowed, requiredPlan } = isToolAllowed(toolName, planTier);
        if (!allowed) {
          return jsonRpcError(id, -32001, `Upgrade to ${requiredPlan?.toUpperCase()} plan to use this tool.`);
        }
      }
      switch (toolName) {
        case "analyze_return": {
          const returnReq = await prisma$1.returnRequest.findUnique({
            where: { id: args.returnId }
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");
          const policies = await prisma$1.policy.findMany({
            where: { shop: returnReq.shop, isActive: true },
            orderBy: { priority: "asc" }
          });
          const items = returnReq.items;
          const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.price || "0") * (i.quantity || 0), 0);
          const daysSinceOrder = returnReq.createdAt ? Math.floor((Date.now() - new Date(returnReq.createdAt).getTime()) / (1e3 * 60 * 60 * 24)) : 0;
          let bestPolicy = null;
          for (const policy of policies) {
            const conditions = policy.conditions;
            const matches = conditions.every((c) => {
              if (c.field === "maxDays") return daysSinceOrder <= c.value;
              if (c.field === "maxAmount") return totalAmount <= c.value;
              return true;
            });
            if (matches) {
              bestPolicy = policy;
              break;
            }
          }
          const autoApprove = bestPolicy?.conditions?.find((c) => c.field === "autoApprove")?.value;
          const restockingFee = bestPolicy?.conditions?.find((c) => c.field === "restockingFee")?.value || 0;
          const maxDays = bestPolicy?.conditions?.find((c) => c.field === "maxDays")?.value || 30;
          const maxAmount = bestPolicy?.conditions?.find((c) => c.field === "maxAmount")?.value || 9999;
          let recommendation;
          let confidence;
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
              restockingFee
            } : null,
            recommendation,
            confidence,
            reasoning: bestPolicy ? `Order matches "${bestPolicy.name}": ${daysSinceOrder} days (≤${maxDays}), $${totalAmount} (≤$${maxAmount})${autoApprove ? ", auto-approve enabled" : ""}` : "No matching policy found. Manual review required."
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
            expiresInMs: 5 * 60 * 1e3,
            message: "Include this token as `confirmationToken` in your approve_return or deny_return call."
          });
        }
        case "approve_return": {
          const returnReq = await prisma$1.returnRequest.findUnique({
            where: { id: args.returnId }
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");
          const secret = process.env.CONFIRMATION_TOKEN_SECRET;
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
              return jsonRpcError(id, -32e3, `Confirmation required: ${check.reason}. Call issue_confirmation_token first.`);
            }
          }
          const allItems = returnReq.items;
          const items = args.returnedItems ? allItems.filter(
            (i) => args.returnedItems.includes(i.id) || args.returnedItems.includes(i.variantId)
          ) : allItems;
          const totalAmount = args.refundAmount || items.reduce(
            (sum, i) => sum + parseFloat(i.price || "0") * (i.quantity || 0),
            0
          );
          const session = await prisma$1.session.findFirst({
            where: { shop: returnReq.shop, isOnline: false }
          });
          let refundResult = null;
          let storeCreditResult = null;
          if (session?.accessToken) {
            try {
              const orderName = returnReq.orderName || returnReq.orderId;
              const orderQuery = `{ orders(first: 1, query: "name:${orderName}") { edges { node { id totalPriceSet { shopMoney { amount } } } } } }`;
              const orderResult = await shopifyAdminQuery(returnReq.shop, session.accessToken, orderQuery);
              const realOrder = orderResult?.data?.orders?.edges?.[0]?.node;
              const realTotal = realOrder ? parseFloat(realOrder.totalPriceSet?.shopMoney?.amount || "0") : 0;
              const orderGid = realOrder?.id || returnReq.orderId;
              const effectiveAmount = args.refundAmount || (items.length > 0 && parseFloat(items[0]?.price || "0") > 0 ? totalAmount : realTotal > 0 ? realTotal : totalAmount);
              if (args.storeCredit) {
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
            } catch (err) {
              if (args.storeCredit) {
                storeCreditResult = { error: err.message };
              } else {
                refundResult = { error: err.message };
              }
            }
          }
          let labelResult = null;
          if (args.issueLabel) {
            labelResult = await createReturnLabel(returnReq.shop, {
              orderName: returnReq.orderName || returnReq.id,
              customerName: returnReq.customerName || "Customer",
              customerEmail: returnReq.customerEmail || "",
              items,
              weight: 1,
              description: returnReq.reason || "Customer return",
              shopAddress: {
                line1: process.env.SHOP_ADDRESS_LINE1 || "",
                city: process.env.SHOP_ADDRESS_CITY || "",
                postalCode: process.env.SHOP_ADDRESS_ZIP || "",
                country: process.env.SHOP_ADDRESS_COUNTRY || "NL"
              }
            });
          }
          const updated = await prisma$1.returnRequest.update({
            where: { id: args.returnId },
            data: {
              status: refundResult?.id || storeCreditResult?.discountCode ? "REFUNDED" : "APPROVED",
              decidedBy: "agent",
              decidedAt: /* @__PURE__ */ new Date(),
              notes: args.notes || null,
              refundAmount: totalAmount,
              refundId: refundResult?.id || storeCreditResult?.discountId || null,
              labels: labelResult?.success ? [{ type: "return_label", status: "ready", url: labelResult.labelUrl, tracking: labelResult.trackingNumber }] : args.issueLabel ? [{ type: "return_label", status: "failed", error: labelResult?.error }] : void 0
            }
          });
          await prisma$1.decisionLog.create({
            data: {
              returnId: args.returnId,
              actor: "agent",
              action: args.storeCredit ? "store_credit" : refundResult?.id ? "refund" : "approve",
              details: {
                refundAmount: totalAmount,
                refundTransactionId: refundResult?.id || null,
                storeCreditCode: storeCreditResult?.discountCode || null,
                storeCreditDiscountId: storeCreditResult?.discountId || null,
                refundError: refundResult?.error || storeCreditResult?.error || null,
                returnedItems: args.returnedItems || null,
                issueLabel: args.issueLabel,
                notes: args.notes
              }
            }
          });
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
            storeCreditError: storeCreditResult?.error || null
          });
        }
        case "deny_return": {
          const returnReq = await prisma$1.returnRequest.findUnique({
            where: { id: args.returnId }
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");
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
              return jsonRpcError(id, -32e3, `Confirmation required: ${check.reason}. Call issue_confirmation_token first.`);
            }
          }
          const updated = await prisma$1.returnRequest.update({
            where: { id: args.returnId },
            data: {
              status: "DENIED",
              decidedBy: "agent",
              decidedAt: /* @__PURE__ */ new Date(),
              notes: args.reason
            }
          });
          await prisma$1.decisionLog.create({
            data: {
              returnId: args.returnId,
              actor: "agent",
              action: "deny",
              details: { reason: args.reason }
            }
          });
          if (returnReq.customerEmail) {
            sendEmail({ ...returnDeniedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", args.reason), to: returnReq.customerEmail });
          }
          return jsonRpcToolResult(id, { success: true, status: "DENIED", returnId: updated.id });
        }
        case "check_fraud": {
          const returnReq = await prisma$1.returnRequest.findUnique({
            where: { id: args.returnId },
            include: { fraudSignals: true }
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");
          const items = returnReq.items;
          const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.price || "0") * (i.quantity || 0), 0);
          const signals = [];
          if (totalAmount > 1e3) {
            signals.push({ signal: "high_value_return", score: 0.3, details: { amount: totalAmount } });
          }
          let recentCount = 0;
          if (returnReq.customerEmail) {
            recentCount = await prisma$1.returnRequest.count({
              where: {
                customerEmail: returnReq.customerEmail,
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3) }
              }
            });
            if (recentCount > 2) {
              signals.push({ signal: "frequent_returner", score: 0.5, details: { returnsIn30Days: recentCount } });
            }
          }
          const shopRec = await prisma$1.shop.findUnique({
            where: { shop: returnReq.shop }
          });
          const customRules = loadFraudRules(shopRec?.config || {});
          const windowMs = customRules.maxReturnsWindowDays * 24 * 60 * 60 * 1e3;
          const windowedCount = returnReq.customerEmail && customRules.maxReturnsWindowDays !== 30 ? await prisma$1.returnRequest.count({
            where: {
              customerEmail: returnReq.customerEmail,
              createdAt: { gte: new Date(Date.now() - windowMs) }
            }
          }) : recentCount;
          const customResult = evaluateFraudRules(
            {
              totalAmount,
              customerEmail: returnReq.customerEmail,
              customerCountry: args.customerCountry || null
            },
            customRules,
            windowedCount
          );
          for (const rule of customResult.triggeredRules) {
            signals.push({
              signal: rule.rule,
              score: rule.score,
              details: { description: rule.details }
            });
          }
          for (const s of signals) {
            await prisma$1.fraudSignal.create({
              data: {
                returnId: args.returnId,
                signal: s.signal,
                score: s.score,
                details: s.details
              }
            });
          }
          const maxScore = signals.length > 0 ? Math.max(...signals.map((s) => s.score)) : 0;
          return jsonRpcToolResult(id, {
            returnId: args.returnId,
            riskLevel: maxScore > 0.5 ? "high" : maxScore > 0.2 ? "medium" : "low",
            riskScore: maxScore,
            signals,
            customRulesApplied: customRules.enabled
          });
        }
        case "list_policies": {
          const policies = await prisma$1.policy.findMany({
            where: { isActive: true },
            orderBy: { priority: "asc" }
          });
          return jsonRpcToolResult(id, {
            policies: policies.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              priority: p.priority,
              conditions: p.conditions
            }))
          });
        }
        case "get_policy_recommendation": {
          const returnReq = await prisma$1.returnRequest.findUnique({
            where: { id: args.returnId }
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");
          const items = returnReq.items;
          const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.price || "0") * (i.quantity || 0), 0);
          const daysSinceOrder = Math.floor((Date.now() - new Date(returnReq.createdAt).getTime()) / (1e3 * 60 * 60 * 24));
          const policies = await prisma$1.policy.findMany({
            where: { shop: returnReq.shop, isActive: true },
            orderBy: { priority: "asc" }
          });
          let bestMatch = null;
          for (const policy of policies) {
            const conditions = policy.conditions;
            const matches = conditions.every((c) => {
              if (c.field === "maxDays") return daysSinceOrder <= c.value;
              if (c.field === "maxAmount") return totalAmount <= c.value;
              return true;
            });
            if (matches) {
              bestMatch = policy;
              break;
            }
          }
          return jsonRpcToolResult(id, {
            totalAmount,
            daysSinceOrder,
            bestMatch: bestMatch ? {
              name: bestMatch.name,
              conditions: bestMatch.conditions
            } : null
          });
        }
        case "list_returns": {
          const where = {};
          if (args.status) where.status = args.status;
          const returns = await prisma$1.returnRequest.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: args.limit || 10
          });
          return jsonRpcToolResult(id, {
            returns: returns.map((r) => ({
              id: r.id,
              orderName: r.orderName,
              customerName: r.customerName,
              status: r.status,
              totalItems: r.items.length,
              createdAt: r.createdAt
            }))
          });
        }
        case "exchange_return": {
          const returnReq = await prisma$1.returnRequest.findUnique({
            where: { id: args.returnId }
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");
          if (returnReq.status !== "PENDING" && returnReq.status !== "EXCHANGE") {
            return jsonRpcError(id, -32602, `Cannot exchange return in status ${returnReq.status}. Only PENDING or EXCHANGE status allowed.`);
          }
          const session = await prisma$1.session.findFirst({
            where: { shop: returnReq.shop, isOnline: false }
          });
          if (!session?.accessToken) {
            return jsonRpcError(id, -32e3, "No Shopify access token available for this store");
          }
          const replacementVariantId = args.replacementVariantId;
          const replacementQuantity = args.replacementQuantity || 1;
          const notes = args.notes || null;
          const draftResult = await createDraftOrder(
            returnReq.shop,
            session.accessToken,
            [{ variantId: replacementVariantId, quantity: replacementQuantity }],
            returnReq.customerEmail || void 0,
            `Exchange for return ${returnReq.id}${notes ? ` - ${notes}` : ""}`
          );
          if (draftResult.error || !draftResult.draftOrderId) {
            return jsonRpcError(id, -32e3, `Failed to create exchange order: ${draftResult.error}`);
          }
          const updated = await prisma$1.returnRequest.update({
            where: { id: args.returnId },
            data: {
              status: "EXCHANGE",
              decidedBy: "agent",
              decidedAt: /* @__PURE__ */ new Date(),
              notes,
              labels: [
                {
                  type: "exchange_order",
                  status: "created",
                  draftOrderId: draftResult.draftOrderId,
                  replacementVariantId,
                  replacementQuantity,
                  createdAt: (/* @__PURE__ */ new Date()).toISOString()
                }
              ]
            }
          });
          await prisma$1.decisionLog.create({
            data: {
              returnId: args.returnId,
              actor: "agent",
              action: "exchange",
              details: {
                draftOrderId: draftResult.draftOrderId,
                replacementVariantId,
                replacementQuantity,
                notes
              }
            }
          });
          return jsonRpcToolResult(id, {
            success: true,
            status: "EXCHANGE",
            returnId: updated.id,
            draftOrderId: draftResult.draftOrderId,
            message: "Exchange order created. The replacement item draft order has been created at no charge."
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

const WINDOW_MS = 60 * 1e3;
const MAX_CALLS_PER_MINUTE = 60;
const MAX_CALLS_PER_DAY = 1e3;
async function checkRateLimit(shop) {
  const now = Date.now();
  const minuteWindow = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const dayStart = /* @__PURE__ */ new Date();
  dayStart.setHours(0, 0, 0, 0);
  const shopRec = await prisma$1.shop.findUnique({ where: { shop } });
  const config = shopRec?.config || {};
  const maxPerMinute = config.rateLimitPerMinute || MAX_CALLS_PER_MINUTE;
  const maxPerDay = config.rateLimitPerDay || MAX_CALLS_PER_DAY;
  const minuteCalls = await prisma$1.decisionLog.count({
    where: {
      actor: "agent",
      createdAt: { gte: new Date(minuteWindow) },
      return: { shop }
    }
  });
  if (minuteCalls >= maxPerMinute) {
    const retryAfter = Math.ceil((minuteWindow + WINDOW_MS - now) / 1e3);
    return {
      allowed: false,
      retryAfterSeconds: retryAfter,
      remaining: 0
    };
  }
  const todayCalls = await prisma$1.decisionLog.count({
    where: {
      actor: "agent",
      createdAt: { gte: dayStart },
      return: { shop }
    }
  });
  if (todayCalls >= maxPerDay) {
    const tomorrow = new Date(dayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const retryAfter = Math.ceil((tomorrow.getTime() - now) / 1e3);
    return {
      allowed: false,
      retryAfterSeconds: retryAfter,
      remaining: 0
    };
  }
  return {
    allowed: true,
    remaining: Math.min(
      maxPerMinute - minuteCalls,
      maxPerDay - todayCalls
    )
  };
}

const action$2 = async ({ request }) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const key = authHeader.slice(7);
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const shop = await prisma$1.shop.findUnique({
    where: { mcpApiKeyHash: hash }
  });
  if (!shop) {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Invalid API key" } },
      { status: 401 }
    );
  }
  if (shop.uninstalledAt) {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Shop has uninstalled the app" } },
      { status: 403 }
    );
  }
  const body = await request.json();
  if (body.jsonrpc !== "2.0" || !body.method) {
    return json(
      { jsonrpc: "2.0", id: body.id || null, error: { code: -32600, message: "Invalid Request" } },
      { status: 400 }
    );
  }
  const method = body.method;
  if (method !== "initialize" && !method.startsWith("notifications/")) {
    const rateCheck = await checkRateLimit(shop.shop);
    if (!rateCheck.allowed) {
      return json(
        {
          jsonrpc: "2.0",
          id: body.id || null,
          error: {
            code: -32029,
            message: `Rate limit exceeded. Retry after ${rateCheck.retryAfterSeconds}s`
          }
        },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds) } }
      );
    }
  }
  const response = await handleMcpRequest(body, shop.shop);
  return json(response);
};
const loader$3 = async () => {
  return json({
    name: "shopigent-returns-mcp",
    version: "0.1.0",
    protocol: "2024-11-05",
    description: "MCP server for Shopigent Returns — AI-agentic return management for Shopify.",
    tools: [
      "analyze_return",
      "approve_return",
      "deny_return",
      "check_fraud",
      "issue_confirmation_token",
      "list_policies",
      "get_policy_recommendation",
      "list_returns"
    ]
  });
};

const route14 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$2,
  loader: loader$3
}, Symbol.toStringTag, { value: 'Module' }));

const loader$2 = () => {
  return json({ ok: true, service: "shopigent-returns", status: "healthy" });
};
const action$1 = () => {
  return json({ ok: true, service: "shopigent-returns", status: "healthy" });
};

const route15 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$1,
  loader: loader$2
}, Symbol.toStringTag, { value: 'Module' }));

const loader$1 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;
  const totalReturns = await prisma$1.returnRequest.count({ where: { shop } });
  const pendingReturns = await prisma$1.returnRequest.count({
    where: { shop, status: "PENDING" }
  });
  const approvedToday = await prisma$1.returnRequest.count({
    where: {
      shop,
      status: "APPROVED",
      decidedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1e3) }
    }
  });
  const totalRefunded = await prisma$1.returnRequest.aggregate({
    where: { shop, status: "REFUNDED" },
    _sum: { refundAmount: true }
  });
  const recentReturns = await prisma$1.returnRequest.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  return json({
    stats: {
      totalReturns,
      pendingReturns,
      approvedToday,
      totalRefunded: totalRefunded._sum.refundAmount || 0
    },
    recentReturns
  });
};
function statusBadge(status) {
  const map = {
    PENDING: { children: "Pending", status: "warning" },
    APPROVED: { children: "Approved", status: "success" },
    DENIED: { children: "Denied", status: "critical" },
    EXCHANGE: { children: "Exchange", status: "info" },
    SHIPPED: { children: "Shipped", status: "info" },
    REFUNDED: { children: "Refunded", status: "success" },
    CLOSED: { children: "Closed", status: "new" }
  };
  return map[status] || { children: status, status: "info" };
}
function Dashboard() {
  const { stats, recentReturns } = useLoaderData();
  const resourceName = {
    singular: "return",
    plural: "returns"
  };
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(recentReturns);
  const rowMarkup = recentReturns.map(
    ({ id, orderName, customerName, status, createdAt }, index) => /* @__PURE__ */ jsxs(
      IndexTable.Row,
      {
        id,
        selected: selectedResources.includes(id),
        position: index,
        children: [
          /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Link$1, { url: `/returns/${id}`, children: orderName || "—" }) }),
          /* @__PURE__ */ jsx(IndexTable.Cell, { children: customerName || "—" }),
          /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Badge, { tone: statusBadge(status).status, children: statusBadge(status).children }) }),
          /* @__PURE__ */ jsx(IndexTable.Cell, { children: new Date(createdAt).toLocaleDateString() })
        ]
      },
      id
    )
  );
  return /* @__PURE__ */ jsxs(Page, { title: "Dashboard", children: [
    /* @__PURE__ */ jsx(TitleBar, { title: "Shopigent Returns" }),
    /* @__PURE__ */ jsxs(Layout, { children: [
      /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
        /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Overview" }),
        /* @__PURE__ */ jsxs(Layout, { children: [
          /* @__PURE__ */ jsx(Layout.Section, { variant: "oneThird", children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingXl", as: "p", fontWeight: "bold", children: stats.totalReturns }),
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "subdued", children: "Total Returns" })
          ] }) }) }),
          /* @__PURE__ */ jsx(Layout.Section, { variant: "oneThird", children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingXl", as: "p", fontWeight: "bold", tone: "critical", children: stats.pendingReturns }),
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "subdued", children: "Pending Review" })
          ] }) }) }),
          /* @__PURE__ */ jsx(Layout.Section, { variant: "oneThird", children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsxs(Text, { variant: "headingXl", as: "p", fontWeight: "bold", tone: "success", children: [
              "$",
              Number(stats.totalRefunded).toFixed(2)
            ] }),
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "subdued", children: "Total Refunded" })
          ] }) }) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Recent Returns" }),
        recentReturns.length === 0 ? /* @__PURE__ */ jsx(Banner, { tone: "info", children: /* @__PURE__ */ jsx("p", { children: "No returns yet. Returns will appear here when customers submit them." }) }) : /* @__PURE__ */ jsx(
          IndexTable,
          {
            resourceName,
            itemCount: recentReturns.length,
            selectedItemsCount: allResourcesSelected ? "All" : selectedResources.length,
            onSelectionChange: handleSelectionChange,
            headings: [
              { title: "Order" },
              { title: "Customer" },
              { title: "Status" },
              { title: "Date" }
            ],
            children: rowMarkup
          }
        )
      ] }) }) })
    ] })
  ] });
}

const route16 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: Dashboard,
  loader: loader$1
}, Symbol.toStringTag, { value: 'Module' }));

function shouldBypassOtp(email) {
  if (process.env.DEV_BYPASS_OTP !== "true") return false;
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return ["example.com", "test.com", "example.org"].includes(domain);
}
function generateDevOtp() {
  return "123456";
}

const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";
  return json({ shop });
};
function generateOtpCode() {
  return Math.floor(1e5 + Math.random() * 9e5).toString();
}
const action = async ({ request }) => {
  const formData = await request.formData();
  const _action = formData.get("_action");
  const shop = formData.get("shop") || "";
  const email = (formData.get("email") || "").trim().toLowerCase();
  if (!shop) {
    return json({ error: "Missing store information. Please use the link provided by the store." });
  }
  if (!email) {
    return json({ error: "Email is required." });
  }
  const session = await prisma$1.session.findFirst({
    where: { shop, isOnline: false }
  });
  if (!session?.accessToken) {
    return json({ error: "Store is not connected. Please try again later." }, { status: 400 });
  }
  if (_action === "request_otp") {
    const code = shouldBypassOtp(email) ? generateDevOtp() : generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1e3);
    await prisma$1.otpCode.updateMany({
      where: { shop, email, used: false },
      data: { used: true }
    });
    await prisma$1.otpCode.create({
      data: { shop, email, code, expiresAt }
    });
    const sent = await sendEmail({
      to: email,
      subject: `Your verification code — Shopigent Returns`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px">
        <h2 style="color:#7C3AED">Shopigent Returns</h2>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center;padding:16px;background:#f3f0ff;border-radius:8px;margin:16px 0;color:#7C3AED">${code}</div>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
      </div>`
    });
    if (!sent && !shouldBypassOtp(email)) {
      return json({ error: "Failed to send verification email. Please try again." });
    }
    if (shouldBypassOtp(email)) {
      return json({ otpSent: true, email, devOtp: code, devMessage: "DEV MODE: Use this code to verify" });
    }
    return json({ otpSent: true, email });
  }
  if (_action === "verify_otp") {
    const code = (formData.get("code") || "").trim();
    if (!code || code.length !== 6) {
      return json({ error: "Please enter the 6-digit code sent to your email." });
    }
    const otp = await prisma$1.otpCode.findFirst({
      where: { shop, email, code, used: false, expiresAt: { gte: /* @__PURE__ */ new Date() } }
    });
    if (!otp) {
      return json({ error: "Invalid or expired code. Please request a new one." });
    }
    await prisma$1.otpCode.update({
      where: { id: otp.id },
      data: { used: true }
    });
    return json({
      verified: true,
      customer: { name: email.split("@")[0] },
      email,
      needsOrderNumber: true,
      message: "Please enter your order number to start the return."
    });
  }
  if (_action === "lookup_order") {
    const orderName = (formData.get("orderName") || "").trim();
    if (!orderName) {
      return json({ error: "Please enter your order number." });
    }
    const formatted = orderName.startsWith("#") ? orderName : `#${orderName}`;
    const mockOrder = {
      id: orderName,
      name: formatted,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      total: "0",
      currency: "USD",
      fulfilled: false,
      items: []
      // customer will add items manually
    };
    return json({
      verified: true,
      customer: { name: email.split("@")[0] },
      orders: [mockOrder],
      email,
      manualEntry: true,
      // flag to show manual item entry form
      message: `Order ${formatted} noted. Now add the items you want to return.`
    });
  }
  if (_action === "submit_return") {
    const orderId = formData.get("orderId");
    const customerName = formData.get("customerName");
    const customerEmail = formData.get("customerEmail");
    const reason = formData.get("reason");
    const orderName2 = formData.get("orderName2");
    let selectedItems = [];
    const itemsJson = formData.get("selectedItems");
    const manualItemNames = formData.get("manualItemNames");
    if (itemsJson) {
      try {
        selectedItems = JSON.parse(itemsJson);
      } catch {
      }
    }
    if (selectedItems.length === 0 && manualItemNames) {
      selectedItems = manualItemNames.split(",").map((s, i) => ({
        id: `manual-${i}`,
        title: s.trim(),
        quantity: 1,
        price: "0"
      }));
    }
    if (!orderId || selectedItems.length === 0) {
      return json({ error: "Please enter at least one item to return." });
    }
    await prisma$1.returnRequest.create({
      data: {
        shop,
        orderId,
        orderName: orderName2,
        customerEmail,
        customerName,
        items: selectedItems,
        reason,
        status: "PENDING"
      }
    });
    return json({ success: true, message: "Return request submitted! We'll review it shortly." });
  }
  return json({ error: "Invalid action" });
};
function ReturnPortal() {
  const { shop } = useLoaderData();
  const fetcher = useFetcher();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [reason, setReason] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [manualItems, setManualItems] = useState([]);
  const data = fetcher.data;
  const isSubmitting = fetcher.state === "submitting";
  const otpSent = data?.otpSent === true;
  const verified = data?.verified === true;
  const success = data?.success === true;
  const error = data?.error;
  const orders = data?.orders || [];
  const customer = data?.customer;
  if (success) {
    return /* @__PURE__ */ jsx("div", { style: { maxWidth: 600, margin: "40px auto", padding: 20 }, children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", align: "center", children: [
      /* @__PURE__ */ jsx(Text, { variant: "headingXl", as: "h1", alignment: "center", tone: "success", children: "✅ Return Submitted!" }),
      /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", alignment: "center", children: data.message }),
      /* @__PURE__ */ jsx(Button, { onClick: () => window.location.reload(), children: "Submit Another Return" })
    ] }) }) });
  }
  return /* @__PURE__ */ jsx("div", { style: { maxWidth: 800, margin: "40px auto", padding: 20 }, children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
    /* @__PURE__ */ jsx(Text, { variant: "headingXl", as: "h1", fontWeight: "bold", children: "Start a Return" }),
    /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "p", tone: "subdued", children: [
      !otpSent && !verified && "Enter your email to receive a verification code.",
      otpSent && !verified && "Enter the 6-digit code sent to your email.",
      verified && `Welcome, ${customer?.name || ""}! Select an order to return items from.`
    ] }),
    error && /* @__PURE__ */ jsx(Banner, { tone: "critical", children: error }),
    !otpSent && !verified && /* @__PURE__ */ jsxs(fetcher.Form, { method: "post", children: [
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "_action", value: "request_otp" }),
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "shop", value: shop }),
      /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
        /* @__PURE__ */ jsx(
          TextField,
          {
            label: "Email Address",
            type: "email",
            name: "email",
            value: email,
            onChange: setEmail,
            placeholder: "your@email.com",
            autoComplete: "email",
            required: true
          }
        ),
        /* @__PURE__ */ jsx(Button, { submit: true, variant: "primary", loading: isSubmitting && fetcher.formData?.get("_action") === "request_otp", disabled: !email, children: "Send Verification Code" })
      ] })
    ] }),
    otpSent && !verified && /* @__PURE__ */ jsxs(fetcher.Form, { method: "post", children: [
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "_action", value: "verify_otp" }),
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "shop", value: shop }),
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "email", value: data.email || email }),
      /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
        /* @__PURE__ */ jsx(
          TextField,
          {
            label: "Verification Code",
            type: "text",
            name: "code",
            value: code,
            onChange: setCode,
            placeholder: "000000",
            maxLength: 6,
            autoComplete: "one-time-code",
            required: true
          }
        ),
        /* @__PURE__ */ jsx(Button, { submit: true, variant: "primary", loading: isSubmitting && fetcher.formData?.get("_action") === "verify_otp", disabled: code.length !== 6, children: "Verify & Look Up Orders" })
      ] })
    ] }),
    verified && data?.needsOrderNumber && !orders?.length && /* @__PURE__ */ jsxs(fetcher.Form, { method: "post", children: [
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "_action", value: "lookup_order" }),
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "shop", value: shop }),
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "email", value: data.email || email }),
      /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
        /* @__PURE__ */ jsx(
          TextField,
          {
            label: "Order Number",
            type: "text",
            name: "orderName",
            value: orderNumber,
            onChange: setOrderNumber,
            placeholder: "e.g. #1001 or 1001"
          }
        ),
        /* @__PURE__ */ jsx(Button, { submit: true, variant: "primary", loading: isSubmitting, disabled: !orderNumber, children: "Find Order" })
      ] })
    ] }),
    verified && orders.length > 0 && /* @__PURE__ */ jsx(BlockStack, { gap: "300", children: orders.map((order) => {
      const orderTotal = parseFloat(order.total);
      const isSelected = selectedOrder === order.id;
      return /* @__PURE__ */ jsxs(Card, { background: isSelected ? "bg-surface-experimental" : void 0, children: [
        /* @__PURE__ */ jsx("div", { style: { cursor: "pointer" }, onClick: () => {
          setSelectedOrder(isSelected ? null : order.id);
          setSelectedItems([]);
        }, children: /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
          /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingSm", as: "h3", fontWeight: "bold", children: order.name }),
            /* @__PURE__ */ jsxs(Text, { variant: "bodySm", as: "p", tone: "subdued", children: [
              new Date(order.createdAt).toLocaleDateString(),
              " · ",
              order.currency,
              " $",
              orderTotal.toFixed(2)
            ] })
          ] }),
          order.fulfilled && /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "success", children: "Delivered" })
        ] }) }),
        isSelected && /* @__PURE__ */ jsx("div", { style: { marginTop: 16 }, children: /* @__PURE__ */ jsxs(fetcher.Form, { method: "post", children: [
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "_action", value: "submit_return" }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "shop", value: shop }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "orderId", value: order.id }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "orderName2", value: order.name }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "customerName", value: customer?.name || "" }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "email", value: data.email || "" }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "customerEmail", value: data.email || "" }),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingSm", as: "h4", fontWeight: "bold", children: "Items to return:" }),
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "p", tone: "subdued", children: 'Enter item names separated by commas (e.g. "Leather Jacket, T-Shirt")' }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                name: "manualItemNames",
                placeholder: "e.g. Leather Jacket, T-Shirt",
                style: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }
              }
            ),
            /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Reason for return",
                name: "reason",
                value: reason,
                onChange: setReason,
                placeholder: "e.g. Wrong size, defective, changed mind...",
                multiline: 2
              }
            ),
            /* @__PURE__ */ jsx(Button, { submit: true, variant: "primary", disabled: !reason, children: "Submit Return Request" })
          ] })
        ] }) })
      ] }, order.id);
    }) }),
    verified && orders.length === 0 && !error && /* @__PURE__ */ jsx(Banner, { tone: "info", children: /* @__PURE__ */ jsx("p", { children: "No orders found for this email." }) })
  ] }) }) });
}

const route17 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action,
  default: ReturnPortal,
  loader
}, Symbol.toStringTag, { value: 'Module' }));

const serverManifest = {'entry':{'module':'/assets/entry.client-EuybElju.js','imports':['/assets/components-DncgAStS.js'],'css':[]},'routes':{'root':{'id':'root','parentId':undefined,'path':'','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':true,'module':'/assets/root-BfxDhPMr.js','imports':['/assets/components-DncgAStS.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/context-BKzuUC7w.js','/assets/context-D_7evObr.js'],'css':[]},'routes/api.refresh-session':{'id':'routes/api.refresh-session','parentId':'root','path':'api/refresh-session','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':false,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.refresh-session-l0sNRNKZ.js','imports':[],'css':[]},'routes/api.check-session':{'id':'routes/api.check-session','parentId':'root','path':'api/check-session','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.check-session-l0sNRNKZ.js','imports':[],'css':[]},'routes/api.upgrade-pro':{'id':'routes/api.upgrade-pro','parentId':'root','path':'api/upgrade-pro','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.upgrade-pro-l0sNRNKZ.js','imports':[],'css':[]},'routes/app.fraud-rules':{'id':'routes/app.fraud-rules','parentId':'root','path':'app/fraud-rules','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/app.fraud-rules-DkrG_FWt.js','imports':['/assets/components-DncgAStS.js','/assets/Page-CAJLY0O6.js','/assets/Layout-C13JKOf2.js','/assets/Banner-DGNxOIFU.js','/assets/ButtonGroup-CPPOhfD3.js','/assets/Checkbox-DcQgWFe6.js','/assets/Tag-DdolXHyk.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/context-BKzuUC7w.js','/assets/banner-context-DEryxoPe.js'],'css':[]},'routes/returns._index':{'id':'routes/returns._index','parentId':'root','path':'returns','index':true,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/returns._index-QL6eQetC.js','imports':['/assets/components-DncgAStS.js','/assets/Link-C9rT3U0_.js','/assets/Page-CAJLY0O6.js','/assets/Layout-C13JKOf2.js','/assets/ButtonGroup-CPPOhfD3.js','/assets/EmptyState-CZyETyrk.js','/assets/context-BKzuUC7w.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/Checkbox-DcQgWFe6.js','/assets/CSSTransition-CYBGIXjC.js','/assets/banner-context-DEryxoPe.js'],'css':[]},'routes/app.exchanges':{'id':'routes/app.exchanges','parentId':'root','path':'app/exchanges','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/app.exchanges-BkRckrdC.js','imports':['/assets/components-DncgAStS.js','/assets/Link-C9rT3U0_.js','/assets/Page-CAJLY0O6.js','/assets/ButtonGroup-CPPOhfD3.js','/assets/TitleBar-DFMSJ8Yc.js','/assets/Layout-C13JKOf2.js','/assets/Banner-DGNxOIFU.js','/assets/EmptyState-CZyETyrk.js','/assets/Modal-Bc17I9P_.js','/assets/Select-CVI6jjHk.js','/assets/context-BKzuUC7w.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/Checkbox-DcQgWFe6.js','/assets/CSSTransition-CYBGIXjC.js','/assets/banner-context-DEryxoPe.js','/assets/context-D_7evObr.js','/assets/InlineGrid-Ba7mGhzc.js'],'css':[]},'routes/api.webhooks':{'id':'routes/api.webhooks','parentId':'root','path':'api/webhooks','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':false,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.webhooks-l0sNRNKZ.js','imports':[],'css':[]},'routes/app.billing':{'id':'routes/app.billing','parentId':'root','path':'app/billing','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/app.billing-YGzPe1nt.js','imports':['/assets/components-DncgAStS.js','/assets/Page-CAJLY0O6.js','/assets/TitleBar-DFMSJ8Yc.js','/assets/Banner-DGNxOIFU.js','/assets/ButtonGroup-CPPOhfD3.js','/assets/InlineGrid-Ba7mGhzc.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/context-BKzuUC7w.js','/assets/banner-context-DEryxoPe.js'],'css':[]},'routes/returns.$id':{'id':'routes/returns.$id','parentId':'root','path':'returns/:id','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/returns._id-BcrZlCyv.js','imports':['/assets/components-DncgAStS.js','/assets/Page-CAJLY0O6.js','/assets/Layout-C13JKOf2.js','/assets/ButtonGroup-CPPOhfD3.js','/assets/Tag-DdolXHyk.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/context-BKzuUC7w.js'],'css':[]},'routes/api.auth.$':{'id':'routes/api.auth.$','parentId':'root','path':'api/auth/*','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.auth._-l0sNRNKZ.js','imports':[],'css':[]},'routes/analytics':{'id':'routes/analytics','parentId':'root','path':'analytics','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/analytics-BhodOGcm.js','imports':['/assets/components-DncgAStS.js','/assets/Page-CAJLY0O6.js','/assets/Layout-C13JKOf2.js','/assets/ButtonGroup-CPPOhfD3.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/context-BKzuUC7w.js'],'css':[]},'routes/policies':{'id':'routes/policies','parentId':'root','path':'policies','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/policies-Dg-dS-cJ.js','imports':['/assets/components-DncgAStS.js','/assets/Page-CAJLY0O6.js','/assets/Layout-C13JKOf2.js','/assets/Banner-DGNxOIFU.js','/assets/ButtonGroup-CPPOhfD3.js','/assets/Tag-DdolXHyk.js','/assets/Modal-Bc17I9P_.js','/assets/Checkbox-DcQgWFe6.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/context-BKzuUC7w.js','/assets/banner-context-DEryxoPe.js','/assets/context-D_7evObr.js','/assets/CSSTransition-CYBGIXjC.js','/assets/InlineGrid-Ba7mGhzc.js'],'css':[]},'routes/settings':{'id':'routes/settings','parentId':'root','path':'settings','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/settings-CeikpiMS.js','imports':['/assets/components-DncgAStS.js','/assets/Page-CAJLY0O6.js','/assets/Layout-C13JKOf2.js','/assets/Banner-DGNxOIFU.js','/assets/ButtonGroup-CPPOhfD3.js','/assets/Select-CVI6jjHk.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/context-BKzuUC7w.js','/assets/banner-context-DEryxoPe.js'],'css':[]},'routes/api.mcp':{'id':'routes/api.mcp','parentId':'root','path':'api/mcp','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.mcp-l0sNRNKZ.js','imports':[],'css':[]},'routes/healthz':{'id':'routes/healthz','parentId':'root','path':'healthz','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/healthz-l0sNRNKZ.js','imports':[],'css':[]},'routes/_index':{'id':'routes/_index','parentId':'root','path':undefined,'index':true,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/_index-Cy-sRJSX.js','imports':['/assets/components-DncgAStS.js','/assets/Link-C9rT3U0_.js','/assets/Page-CAJLY0O6.js','/assets/TitleBar-DFMSJ8Yc.js','/assets/Layout-C13JKOf2.js','/assets/ButtonGroup-CPPOhfD3.js','/assets/Banner-DGNxOIFU.js','/assets/context-BKzuUC7w.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/Checkbox-DcQgWFe6.js','/assets/CSSTransition-CYBGIXjC.js','/assets/banner-context-DEryxoPe.js'],'css':[]},'routes/return':{'id':'routes/return','parentId':'root','path':'return','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/return-DyOEkchd.js','imports':['/assets/components-DncgAStS.js','/assets/ButtonGroup-CPPOhfD3.js','/assets/Banner-DGNxOIFU.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/banner-context-DEryxoPe.js'],'css':[]}},'url':'/assets/manifest-6dca36d0.js','version':'6dca36d0'};

/**
       * `mode` is only relevant for the old Remix compiler but
       * is included here to satisfy the `ServerBuild` typings.
       */
      const mode = "production";
      const assetsBuildDirectory = "build/client";
      const basename = "/";
      const future = {"v3_fetcherPersist":false,"v3_relativeSplatPath":false,"v3_throwAbortReason":false,"v3_routeConfig":false,"v3_singleFetch":false,"v3_lazyRouteDiscovery":false,"unstable_optimizeDeps":false};
      const isSpaMode = false;
      const publicPath = "/";
      const entry = { module: entryServer };
      const routes = {
        "root": {
          id: "root",
          parentId: undefined,
          path: "",
          index: undefined,
          caseSensitive: undefined,
          module: route0
        },
  "routes/api.refresh-session": {
          id: "routes/api.refresh-session",
          parentId: "root",
          path: "api/refresh-session",
          index: undefined,
          caseSensitive: undefined,
          module: route1
        },
  "routes/api.check-session": {
          id: "routes/api.check-session",
          parentId: "root",
          path: "api/check-session",
          index: undefined,
          caseSensitive: undefined,
          module: route2
        },
  "routes/api.upgrade-pro": {
          id: "routes/api.upgrade-pro",
          parentId: "root",
          path: "api/upgrade-pro",
          index: undefined,
          caseSensitive: undefined,
          module: route3
        },
  "routes/app.fraud-rules": {
          id: "routes/app.fraud-rules",
          parentId: "root",
          path: "app/fraud-rules",
          index: undefined,
          caseSensitive: undefined,
          module: route4
        },
  "routes/returns._index": {
          id: "routes/returns._index",
          parentId: "root",
          path: "returns",
          index: true,
          caseSensitive: undefined,
          module: route5
        },
  "routes/app.exchanges": {
          id: "routes/app.exchanges",
          parentId: "root",
          path: "app/exchanges",
          index: undefined,
          caseSensitive: undefined,
          module: route6
        },
  "routes/api.webhooks": {
          id: "routes/api.webhooks",
          parentId: "root",
          path: "api/webhooks",
          index: undefined,
          caseSensitive: undefined,
          module: route7
        },
  "routes/app.billing": {
          id: "routes/app.billing",
          parentId: "root",
          path: "app/billing",
          index: undefined,
          caseSensitive: undefined,
          module: route8
        },
  "routes/returns.$id": {
          id: "routes/returns.$id",
          parentId: "root",
          path: "returns/:id",
          index: undefined,
          caseSensitive: undefined,
          module: route9
        },
  "routes/api.auth.$": {
          id: "routes/api.auth.$",
          parentId: "root",
          path: "api/auth/*",
          index: undefined,
          caseSensitive: undefined,
          module: route10
        },
  "routes/analytics": {
          id: "routes/analytics",
          parentId: "root",
          path: "analytics",
          index: undefined,
          caseSensitive: undefined,
          module: route11
        },
  "routes/policies": {
          id: "routes/policies",
          parentId: "root",
          path: "policies",
          index: undefined,
          caseSensitive: undefined,
          module: route12
        },
  "routes/settings": {
          id: "routes/settings",
          parentId: "root",
          path: "settings",
          index: undefined,
          caseSensitive: undefined,
          module: route13
        },
  "routes/api.mcp": {
          id: "routes/api.mcp",
          parentId: "root",
          path: "api/mcp",
          index: undefined,
          caseSensitive: undefined,
          module: route14
        },
  "routes/healthz": {
          id: "routes/healthz",
          parentId: "root",
          path: "healthz",
          index: undefined,
          caseSensitive: undefined,
          module: route15
        },
  "routes/_index": {
          id: "routes/_index",
          parentId: "root",
          path: undefined,
          index: true,
          caseSensitive: undefined,
          module: route16
        },
  "routes/return": {
          id: "routes/return",
          parentId: "root",
          path: "return",
          index: undefined,
          caseSensitive: undefined,
          module: route17
        }
      };

export { serverManifest as assets, assetsBuildDirectory, basename, entry, future, isSpaMode, mode, publicPath, routes };
