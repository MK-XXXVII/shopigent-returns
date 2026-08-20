import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  BlockStack,
  Text,
  Banner,
  Button,
  TextField as PolTextField,
  Checkbox,
  InlineStack,
  Modal,
  Tag,
  Card,
  List,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";

// Controlled TextField wrapper that syncs value/onChange with hidden inputs
function FormField({
  label,
  name,
  type,
  value,
  onChange,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  [key: string]: any;
}) {
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <PolTextField
        label={label}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete="off"
        {...rest}
      />
    </>
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const policies = await prisma.policy.findMany({
    where: { shop: session.shop },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });
  return json({ policies });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const formData = await request.formData();
  const _action = formData.get("_action");

  if (_action === "create" || _action === "update") {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const priority = parseInt(formData.get("priority") as string) || 0;
    const isActive = formData.get("isActive") === "true";
    const conditions = [
      { field: "maxDays", operator: "lte", value: parseInt(formData.get("maxDays") as string) || 30 },
      { field: "maxAmount", operator: "lte", value: parseFloat(formData.get("maxAmount") as string) || 9999 },
      { field: "autoApprove", operator: "eq", value: formData.get("autoApprove") === "true" },
      { field: "restockingFee", operator: "eq", value: parseFloat(formData.get("restockingFee") as string) || 0 },
      { field: "requiresReturnLabel", operator: "eq", value: formData.get("requiresReturnLabel") === "true" },
    ];
    if (_action === "create") {
      await prisma.policy.create({
        data: { shop: session.shop, name, description, priority, isActive, conditions },
      });
    } else if (id) {
      await prisma.policy.update({
        where: { id },
        data: { name, description, priority, isActive, conditions },
      });
    }
  } else if (_action === "delete") {
    await prisma.policy.delete({ where: { id: formData.get("id") as string } });
  } else if (_action === "toggle") {
    const id = formData.get("id") as string;
    const policy = await prisma.policy.findUnique({ where: { id } });
    if (policy) {
      await prisma.policy.update({ where: { id }, data: { isActive: !policy.isActive } });
    }
  }
  return json({ ok: true });
};

interface PolicyData {
  id: string;
  name: string;
  description: string;
  priority: number;
  isActive: boolean;
  conditions: any[];
}

function getCond(conditions: any[], field: string) {
  return conditions.find((c: any) => c.field === field);
}

const emptyForm = () => ({
  name: "",
  description: "",
  priority: "0",
  maxDays: "30",
  maxAmount: "200",
  autoApprove: false,
  restockingFee: "0",
  requiresReturnLabel: false,
});

export default function PoliciesPage() {
  const { policies } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [active, setActive] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [f, setF] = useState(emptyForm());

  const isNew = !editingId;

  // Close modal when submission succeeds
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

  const openEdit = (p: PolicyData) => {
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
      requiresReturnLabel: getCond(c, "requiresReturnLabel")?.value === true,
    });
    setActive(true);
  };

  const closeModal = () => {
    setActive(false);
    setEditingId(null);
  };

  const u = (field: string) => (val: string | boolean) =>
    setF((prev: any) => ({ ...prev, [field]: val }));

  // Derive a color for the policy priority (lower = higher priority = stronger color)
  const priorityColor = (p: number) => {
    if (p === 1) return { bg: "#7C3AED", label: "#fff" }; // highest — purple
    if (p === 2) return { bg: "#2563EB", label: "#fff" }; // blue
    return { bg: "#64748B", label: "#fff" };              // gray
  };

  // Two proposals for a premium, user-friendly policy card. Returning both
  // styled variants here so the merchant can pick the one they prefer.
  return (
    <Page title="Return Policies"
      primaryAction={{ content: "Add Policy", onAction: openNew }}
    >
      <style>{`
        /* Custom on/off toggle switch (Polaris lacks a Switch in this version) */
        .policy-toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
        .policy-toggle input { opacity: 0; width: 0; height: 0; }
        .policy-toggle .slider {
          position: absolute; cursor: pointer; inset: 0; border-radius: 999px;
          background: #d1d5db; transition: .25s; box-shadow: inset 0 1px 3px rgba(0,0,0,.1);
        }
        .policy-toggle .slider:before {
          content: ""; position: absolute; height: 18px; width: 18px; left: 3px; top: 3px;
          background: #fff; border-radius: 50%; transition: .25s; box-shadow: 0 1px 3px rgba(0,0,0,.25);
        }
        .policy-toggle input:checked + .slider { background: linear-gradient(135deg,#7C3AED,#10B981); }
        .policy-toggle input:checked + .slider:before { transform: translateX(20px); }
        .policy-card-enter { animation: fadeUp .3s ease; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>
      <Layout>
        <Layout.Section>
          {policies.length === 0 ? (
            <Banner tone="info">
              <p>No policies yet. Create your first return policy to start automating return decisions.</p>
            </Banner>
          ) : (
            policies.map((p: PolicyData, idx: number) => {
              const c = p.conditions;
              const autoApprove = getCond(c, "autoApprove")?.value;
              const fee = getCond(c, "restockingFee")?.value ?? 0;
              const maxDays = getCond(c, "maxDays")?.value ?? 30;
              const maxAmount = getCond(c, "maxAmount")?.value ?? 200;
              const pColor = priorityColor(p.priority);
              return (
                <Card key={p.id}>
                  <div className="policy-card-enter" style={{ animationDelay: `${idx * 50}ms` }}>
                    <BlockStack gap="300">
                      {/* Header: left title + right switch & actions */}
                      <InlineStack align="space-between" wrap={true} gap="300">
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                          {/* Priority color band */}
                          <div style={{
                            width: 6, alignSelf: "stretch", borderRadius: 4,
                            background: pColor.bg, minHeight: 36,
                          }} />
                          <BlockStack gap="50">
                            <Text variant="headingLg" as="h3" fontWeight="bold">
                              {p.name}
                            </Text>
                            {p.description && (
                              <Text variant="bodySm" as="p" tone="subdued">
                                {p.description}
                              </Text>
                            )}
                          </BlockStack>
                        </InlineStack>

                        <InlineStack gap="200" blockAlign="center">
                          {/* On/Off toggle */}
                          <label className="policy-toggle" title={p.isActive ? "Active" : "Disabled"}>
                            <input
                              type="checkbox"
                              checked={p.isActive}
                              onChange={() => fetcher.submit({ _action: "toggle", id: p.id }, { method: "post" })}
                            />
                            <span className="slider" />
                          </label>
                          <Button size="slim" onClick={() => openEdit(p)}>Edit</Button>
                          <Button size="slim" tone="critical" onClick={() => {
                            if (confirm(`Delete policy "${p.name}"?`)) {
                              fetcher.submit({ _action: "delete", id: p.id }, { method: "post" });
                            }
                          }}>Delete</Button>
                        </InlineStack>
                      </InlineStack>

                      {/* Disabled notice */}
                      {!p.isActive && (
                        <Banner tone="critical">
                          <p>This policy is currently disabled — returns do not match against it.</p>
                        </Banner>
                      )}

                      {/* Condition tags — color-coded for scannability */}
                      <InlineStack gap="200" wrap={true}>
                        <Tag tone="attention">Priority {p.priority}</Tag>
                        <Tag tone="info">⏱ ≤ {maxDays} days</Tag>
                        <Tag tone={maxAmount >= 200 ? "warning" : "success"}>≤ ${maxAmount}</Tag>
                        {autoApprove ? (
                          <Tag tone="success">⚡ Auto-approve</Tag>
                        ) : (
                          <Tag tone="critical">🔒 Manual review</Tag>
                        )}
                        {Number(fee) > 0 && <Tag tone="warning">{fee}% restocking fee</Tag>}
                      </InlineStack>
                    </BlockStack>
                  </div>
                </Card>
              );
            })
          )}
        </Layout.Section>
      </Layout>

      <Modal open={active} onClose={closeModal} title={isNew ? "Create Policy" : "Edit Policy"}>
        <Modal.Section>
          <fetcher.Form method="post" id="policy-form">
            <input type="hidden" name="_action" value={isNew ? "create" : "update"} />
            {!isNew && <input type="hidden" name="id" value={editingId!} />}
            <input type="hidden" name="isActive" value="true" />
            <input type="hidden" name="autoApprove" value={String(f.autoApprove)} />
            <input type="hidden" name="requiresReturnLabel" value={String(f.requiresReturnLabel)} />

            <BlockStack gap="400">
              <FormField label="Policy Name" name="name" value={f.name} onChange={u("name")} required />
              <FormField label="Description" name="description" value={f.description} onChange={u("description")} multiline={2} />
              <FormField label="Priority (lower = checked first)" name="priority" type="number" value={f.priority} onChange={u("priority")} />
              <FormField label="Max Days for Return" name="maxDays" type="number" value={f.maxDays} onChange={u("maxDays")} />
              <FormField label="Max Amount for Auto-approve ($)" name="maxAmount" type="number" prefix="$" step="0.01" value={f.maxAmount} onChange={u("maxAmount")} />

              <Checkbox
                label="Auto-approve returns matching this policy"
                checked={f.autoApprove}
                onChange={u("autoApprove")}
              />

              <FormField label="Restocking Fee (%)" name="restockingFee" type="number" suffix="%" step="0.5" value={f.restockingFee} onChange={u("restockingFee")} />

              <Checkbox
                label="Require return label"
                checked={f.requiresReturnLabel}
                onChange={u("requiresReturnLabel")}
              />

              <Button
                onClick={() => {
                  const form = document.querySelector("#policy-form") as HTMLFormElement;
                  if (form) fetcher.submit(form);
                }}
                variant="primary"
              >
                {isNew ? "Create Policy" : "Update Policy"}
              </Button>
            </BlockStack>
          </fetcher.Form>
        </Modal.Section>
      </Modal>
    </Page>
  );
}