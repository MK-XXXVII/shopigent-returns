import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { RemixServer, useLoaderData, Meta, Links, Link, Outlet, ScrollRestoration, Scripts, useRouteError, isRouteErrorResponse, useFetcher } from '@remix-run/react';
import { renderToString } from 'react-dom/server';
import { AppProvider } from '@shopify/shopify-app-remix/react';
import { NavMenu, TitleBar } from '@shopify/app-bridge-react';
import '@shopify/shopify-app-remix/server/adapters/node';
import { shopifyApp, AppDistribution, ApiVersion } from '@shopify/shopify-app-remix/server';
import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma';
import { PrismaClient } from '@prisma/client';
import { json } from '@remix-run/node';
import { useIndexResourceState, IndexTable, Link as Link$1, Badge, Page, Layout, BlockStack, Card, Text, EmptyState, InlineStack, Button, Tag, Banner, Modal, Checkbox, TextField } from '@shopify/polaris';
import { useState, useEffect } from 'react';

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
  future: {
    expiringOfflineAccessTokens: true
  }
});
const authenticate = shopify.authenticate;
shopify.login;
shopify.registerWebhooks;
shopify.sessionStorage;

const links = () => [{ rel: "stylesheet", href: polarisStyles }];
const loader$6 = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};
function App() {
  const { apiKey } = useLoaderData();
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
      /* @__PURE__ */ jsxs(AppProvider, { isEmbeddedApp: true, apiKey, children: [
        /* @__PURE__ */ jsxs(NavMenu, { children: [
          /* @__PURE__ */ jsx(Link, { to: "/", children: "Dashboard" }),
          /* @__PURE__ */ jsx(Link, { to: "/policies", children: "Policies" }),
          /* @__PURE__ */ jsx(Link, { to: "/returns", children: "Returns" })
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
  loader: loader$6
}, Symbol.toStringTag, { value: 'Module' }));

const STATUS_COLORS$1 = {
  PENDING: "warning",
  APPROVED: "success",
  DENIED: "critical",
  EXCHANGE: "info",
  SHIPPED: "info",
  REFUNDED: "success",
  CLOSED: "new"
};
const loader$5 = async ({ request }) => {
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
function statusBadge$1(status) {
  return {
    children: status.charAt(0) + status.slice(1).toLowerCase(),
    tone: STATUS_COLORS$1[status] || "info"
  };
}
function ReturnsPage() {
  const { returns, counts, currentStatus } = useLoaderData();
  const resourceName = { singular: "return", plural: "returns" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(returns);
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const rowMarkup = returns.map(
    ({ id, orderName, customerName, status, createdAt }, index) => {
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

const route1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: ReturnsPage,
  loader: loader$5
}, Symbol.toStringTag, { value: 'Module' }));

async function action$2({ request }) {
  const { topic, shop, session, admin } = await shopify.authenticate.webhook(
    request
  );
  switch (topic) {
    case "APP_UNINSTALLED": {
      await prisma$1.shop.updateMany({
        where: { shop },
        data: { uninstalledAt: /* @__PURE__ */ new Date() }
      });
      break;
    }
    case "ORDERS_FULFILLED": {
      const payload = await request.json();
      const orderId = payload.id;
      const orderName = payload.name;
      const customerEmail = payload.email || payload.contact_email;
      const customerName = payload.customer ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim() : null;
      await prisma$1.returnRequest.create({
        data: {
          shop,
          orderId: `gid://shopify/Order/${orderId}`,
          orderName,
          customerEmail,
          customerName,
          items: (payload.line_items || []).map((item) => ({
            variantId: `gid://shopify/ProductVariant/${item.variant_id}`,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            sku: item.sku
          })),
          status: "PENDING"
        }
      });
      break;
    }
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }
  return new Response(null, { status: 200 });
}

const route2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$2
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
const loader$4 = async ({ request, params }) => {
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

const route3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: ReturnDetailPage,
  loader: loader$4
}, Symbol.toStringTag, { value: 'Module' }));

const loader$3 = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

const route4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  loader: loader$3
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
const loader$2 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const policies = await prisma$1.policy.findMany({
    where: { shop: session.shop },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
  });
  return json({ policies });
};
const action$1 = async ({ request }) => {
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

const route5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$1,
  default: PoliciesPage,
  loader: loader$2
}, Symbol.toStringTag, { value: 'Module' }));

const loader$1 = () => {
  return json({ ok: true, service: "shopigent-returns", status: "healthy" });
};
const action = () => {
  return json({ ok: true, service: "shopigent-returns", status: "healthy" });
};

const route6 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action,
  loader: loader$1
}, Symbol.toStringTag, { value: 'Module' }));

const loader = async ({ request }) => {
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

const route7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: Dashboard,
  loader
}, Symbol.toStringTag, { value: 'Module' }));

const serverManifest = {'entry':{'module':'/assets/entry.client-DyfKaOos.js','imports':['/assets/components-Cc6YJ0TE.js'],'css':[]},'routes':{'root':{'id':'root','parentId':undefined,'path':'','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':true,'module':'/assets/root-CM4gSoWc.js','imports':['/assets/components-Cc6YJ0TE.js','/assets/context-BiUeL77I.js','/assets/context-DeYyIiJd.js'],'css':[]},'routes/returns._index':{'id':'routes/returns._index','parentId':'root','path':'returns','index':true,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/returns._index-BRXYRwLK.js','imports':['/assets/components-Cc6YJ0TE.js','/assets/Link-CmO3Lr94.js','/assets/Page-CPlWv2R_.js','/assets/context-BiUeL77I.js','/assets/CSSTransition-DN7ggXK3.js'],'css':[]},'routes/api.webhooks':{'id':'routes/api.webhooks','parentId':'root','path':'api/webhooks','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':false,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.webhooks-l0sNRNKZ.js','imports':[],'css':[]},'routes/returns.$id':{'id':'routes/returns.$id','parentId':'root','path':'returns/:id','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/returns._id-DOVItyYJ.js','imports':['/assets/components-Cc6YJ0TE.js','/assets/Page-CPlWv2R_.js','/assets/Tag-BvoGdaI8.js','/assets/context-BiUeL77I.js'],'css':[]},'routes/api.auth.$':{'id':'routes/api.auth.$','parentId':'root','path':'api/auth/*','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.auth._-l0sNRNKZ.js','imports':[],'css':[]},'routes/policies':{'id':'routes/policies','parentId':'root','path':'policies','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/policies-B-eqRXuS.js','imports':['/assets/components-Cc6YJ0TE.js','/assets/Page-CPlWv2R_.js','/assets/Banner-Cb6iWn5w.js','/assets/Tag-BvoGdaI8.js','/assets/context-BiUeL77I.js','/assets/context-DeYyIiJd.js','/assets/CSSTransition-DN7ggXK3.js'],'css':[]},'routes/healthz':{'id':'routes/healthz','parentId':'root','path':'healthz','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/healthz-l0sNRNKZ.js','imports':[],'css':[]},'routes/_index':{'id':'routes/_index','parentId':'root','path':undefined,'index':true,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/_index-Ca8KTJQR.js','imports':['/assets/components-Cc6YJ0TE.js','/assets/Link-CmO3Lr94.js','/assets/Page-CPlWv2R_.js','/assets/Banner-Cb6iWn5w.js','/assets/context-BiUeL77I.js','/assets/CSSTransition-DN7ggXK3.js'],'css':[]}},'url':'/assets/manifest-f887e8b1.js','version':'f887e8b1'};

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
  "routes/returns._index": {
          id: "routes/returns._index",
          parentId: "root",
          path: "returns",
          index: true,
          caseSensitive: undefined,
          module: route1
        },
  "routes/api.webhooks": {
          id: "routes/api.webhooks",
          parentId: "root",
          path: "api/webhooks",
          index: undefined,
          caseSensitive: undefined,
          module: route2
        },
  "routes/returns.$id": {
          id: "routes/returns.$id",
          parentId: "root",
          path: "returns/:id",
          index: undefined,
          caseSensitive: undefined,
          module: route3
        },
  "routes/api.auth.$": {
          id: "routes/api.auth.$",
          parentId: "root",
          path: "api/auth/*",
          index: undefined,
          caseSensitive: undefined,
          module: route4
        },
  "routes/policies": {
          id: "routes/policies",
          parentId: "root",
          path: "policies",
          index: undefined,
          caseSensitive: undefined,
          module: route5
        },
  "routes/healthz": {
          id: "routes/healthz",
          parentId: "root",
          path: "healthz",
          index: undefined,
          caseSensitive: undefined,
          module: route6
        },
  "routes/_index": {
          id: "routes/_index",
          parentId: "root",
          path: undefined,
          index: true,
          caseSensitive: undefined,
          module: route7
        }
      };

export { serverManifest as assets, assetsBuildDirectory, basename, entry, future, isSpaMode, mode, publicPath, routes };
