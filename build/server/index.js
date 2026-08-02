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
import { Page, Layout, Banner, BlockStack, InlineStack, Text, Tag, Button, Modal, Checkbox, TextField, useIndexResourceState, IndexTable, Link as Link$1, Badge, Card } from '@shopify/polaris';
import { useState } from 'react';

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
const loader$4 = async ({ request }) => {
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
  loader: loader$4
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

const route1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$2
}, Symbol.toStringTag, { value: 'Module' }));

const loader$3 = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

const route2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
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
          return /* @__PURE__ */ jsx("div", { style: {
            borderLeft: `4px solid ${p.isActive ? "#2e7d32" : "#9e9e9e"}`,
            background: "#1a1a2e",
            borderRadius: 8,
            padding: 16,
            marginBottom: 12
          }, children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
              /* @__PURE__ */ jsxs(Text, { variant: "headingSm", as: "h3", fontWeight: "bold", children: [
                p.name,
                !p.isActive && /* @__PURE__ */ jsx(Tag, { tone: "critical", style: { marginLeft: 8 }, children: "Disabled" })
              ] }),
              /* @__PURE__ */ jsxs(InlineStack, { gap: "200", children: [
                /* @__PURE__ */ jsx(Button, { size: "slim", onClick: () => {
                  fetcher.submit({ _action: "toggle", id: p.id }, { method: "post" });
                }, children: p.isActive ? "Disable" : "Enable" }),
                /* @__PURE__ */ jsx(Button, { size: "slim", onClick: () => openEdit(p), children: "Edit" }),
                /* @__PURE__ */ jsx(Button, { size: "slim", tone: "critical", onClick: () => {
                  fetcher.submit({ _action: "delete", id: p.id }, { method: "post" });
                }, children: "Delete" })
              ] })
            ] }),
            p.description && /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "p", tone: "subdued", children: p.description }),
            /* @__PURE__ */ jsxs(InlineStack, { gap: "300", wrap: true, children: [
              /* @__PURE__ */ jsxs(Tag, { children: [
                "Priority: ",
                p.priority
              ] }),
              /* @__PURE__ */ jsxs(Tag, { children: [
                "Days: ≤",
                getCond(c, "maxDays")?.value ?? 30
              ] }),
              /* @__PURE__ */ jsxs(Tag, { children: [
                "Max: $",
                getCond(c, "maxAmount")?.value ?? 200
              ] }),
              autoApprove && /* @__PURE__ */ jsx(Tag, { tone: "success", children: "Auto-approve" }),
              Number(fee) > 0 && /* @__PURE__ */ jsxs(Tag, { children: [
                "Fee: ",
                fee,
                "%"
              ] })
            ] })
          ] }) }, p.id);
        }) }) }),
        /* @__PURE__ */ jsx(Modal, { open: active, onClose: closeModal, title: isNew ? "Create Policy" : "Edit Policy", children: /* @__PURE__ */ jsx(Modal.Section, { children: /* @__PURE__ */ jsxs(fetcher.Form, { method: "post", children: [
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
            /* @__PURE__ */ jsx(Button, { submit: true, variant: "primary", children: isNew ? "Create Policy" : "Update Policy" })
          ] })
        ] }) }) })
      ]
    }
  );
}

const route3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
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

const route4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
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

const route5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: Dashboard,
  loader
}, Symbol.toStringTag, { value: 'Module' }));

const serverManifest = {'entry':{'module':'/assets/entry.client-rQsLK_wk.js','imports':['/assets/components-DQ_Zdf-t.js'],'css':[]},'routes':{'root':{'id':'root','parentId':undefined,'path':'','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':true,'module':'/assets/root-QesI13tm.js','imports':['/assets/components-DQ_Zdf-t.js','/assets/context-C6dfzWjK.js','/assets/context-clUgH11Y.js'],'css':[]},'routes/api.webhooks':{'id':'routes/api.webhooks','parentId':'root','path':'api/webhooks','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':false,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.webhooks-l0sNRNKZ.js','imports':[],'css':[]},'routes/api.auth.$':{'id':'routes/api.auth.$','parentId':'root','path':'api/auth/*','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.auth._-l0sNRNKZ.js','imports':[],'css':[]},'routes/policies':{'id':'routes/policies','parentId':'root','path':'policies','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/policies-B-wxXQi4.js','imports':['/assets/components-DQ_Zdf-t.js','/assets/Page-BCfr31u2.js','/assets/context-C6dfzWjK.js','/assets/context-clUgH11Y.js'],'css':[]},'routes/healthz':{'id':'routes/healthz','parentId':'root','path':'healthz','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/healthz-l0sNRNKZ.js','imports':[],'css':[]},'routes/_index':{'id':'routes/_index','parentId':'root','path':undefined,'index':true,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/_index-CGGEEXo8.js','imports':['/assets/components-DQ_Zdf-t.js','/assets/context-C6dfzWjK.js','/assets/Page-BCfr31u2.js'],'css':[]}},'url':'/assets/manifest-7c17b1d3.js','version':'7c17b1d3'};

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
  "routes/api.webhooks": {
          id: "routes/api.webhooks",
          parentId: "root",
          path: "api/webhooks",
          index: undefined,
          caseSensitive: undefined,
          module: route1
        },
  "routes/api.auth.$": {
          id: "routes/api.auth.$",
          parentId: "root",
          path: "api/auth/*",
          index: undefined,
          caseSensitive: undefined,
          module: route2
        },
  "routes/policies": {
          id: "routes/policies",
          parentId: "root",
          path: "policies",
          index: undefined,
          caseSensitive: undefined,
          module: route3
        },
  "routes/healthz": {
          id: "routes/healthz",
          parentId: "root",
          path: "healthz",
          index: undefined,
          caseSensitive: undefined,
          module: route4
        },
  "routes/_index": {
          id: "routes/_index",
          parentId: "root",
          path: undefined,
          index: true,
          caseSensitive: undefined,
          module: route5
        }
      };

export { serverManifest as assets, assetsBuildDirectory, basename, entry, future, isSpaMode, mode, publicPath, routes };
