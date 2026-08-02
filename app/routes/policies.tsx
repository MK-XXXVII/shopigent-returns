import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Banner,
  Button,
  TextField,
  Select,
  Checkbox,
  InlineStack,
  Modal,
  Tag,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback } from "react";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";

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
      {
        field: "maxDays",
        operator: "lte",
        value: parseInt(formData.get("maxDays") as string) || 30,
      },
      {
        field: "maxAmount",
        operator: "lte",
        value: parseFloat(formData.get("maxAmount") as string) || 9999,
      },
      {
        field: "autoApprove",
        operator: "eq",
        value: formData.get("autoApprove") === "true",
      },
      {
        field: "restockingFee",
        operator: "eq",
        value: parseFloat(formData.get("restockingFee") as string) || 0,
      },
      {
        field: "requiresReturnLabel",
        operator: "eq",
        value: formData.get("requiresReturnLabel") === "true",
      },
    ];

    if (_action === "create") {
      await prisma.policy.create({
        data: {
          shop: session.shop,
          name,
          description,
          priority,
          isActive,
          conditions,
        },
      });
    } else if (id) {
      await prisma.policy.update({
        where: { id },
        data: { name, description, priority, isActive, conditions },
      });
    }
  } else if (_action === "delete") {
    const id = formData.get("id") as string;
    await prisma.policy.delete({ where: { id } });
  } else if (_action === "toggle") {
    const id = formData.get("id") as string;
    const policy = await prisma.policy.findUnique({ where: { id } });
    if (policy) {
      await prisma.policy.update({
        where: { id },
        data: { isActive: !policy.isActive },
      });
    }
  }

  return json({ ok: true });
};

function PolicyCard({
  policy,
  onEdit,
}: {
  policy: any;
  onEdit: (p: any) => void;
}) {
  const fetcher = useFetcher();
  const conditions = policy.conditions as any[];

  const getCondition = (field: string) =>
    conditions.find((c: any) => c.field === field);

  const maxDays = getCondition("maxDays")?.value ?? 30;
  const maxAmount = getCondition("maxAmount")?.value ?? 9999;
  const autoApprove = getCondition("autoApprove")?.value;
  const restockingFee = getCondition("restockingFee")?.value ?? 0;

  return (
    <div
      style={{
        borderLeft: `4px solid ${policy.isActive ? "#2e7d32" : "#9e9e9e"}`,
        background: "#1a1a2e",
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <BlockStack gap="200">
        <InlineStack align="space-between">
          <Text variant="headingSm" as="h3" fontWeight="bold">
            {policy.name}
            {!policy.isActive && (
              <Tag tone="critical" style={{ marginLeft: 8 }}>
                Disabled
              </Tag>
            )}
          </Text>
          <InlineStack gap="200">
            <Button
              size="slim"
              onClick={() =>
                fetcher.submit(
                  { _action: "toggle", id: policy.id },
                  { method: "post" }
                )
              }
            >
              {policy.isActive ? "Disable" : "Enable"}
            </Button>
            <Button size="slim" onClick={() => onEdit(policy)}>
              Edit
            </Button>
            <Button
              size="slim"
              tone="critical"
              onClick={() =>
                fetcher.submit(
                  { _action: "delete", id: policy.id },
                  { method: "post" }
                )
              }
            >
              Delete
            </Button>
          </InlineStack>
        </InlineStack>

        {policy.description && (
          <Text variant="bodySm" as="p" tone="subdued">
            {policy.description}
          </Text>
        )}

        <InlineStack gap="300" wrap={true}>
          <Tag>Priority: {policy.priority}</Tag>
          <Tag>Days: ≤{maxDays}</Tag>
          <Tag>Max: ${maxAmount}</Tag>
          {autoApprove && <Tag tone="success">Auto-approve</Tag>}
          {restockingFee > 0 && <Tag>Fee: {restockingFee}%</Tag>}
        </InlineStack>
      </BlockStack>
    </div>
  );
}

export default function PoliciesPage() {
  const { policies } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [active, setActive] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const openNew = () => {
    setEditing(null);
    setActive(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setActive(true);
  };

  const closeModal = () => {
    setActive(false);
    setEditing(null);
  };

  const isNew = !editing;
  const c = (editing?.conditions as any[]) || [];

  return (
    <Page
      title="Return Policies"
      primaryAction={{ content: "Add Policy", onAction: openNew }}
    >
      <TitleBar title="Shopigent Returns" />

      <Layout>
        <Layout.Section>
          {policies.length === 0 ? (
            <Banner tone="info">
              <p>
                No policies yet. Create your first return policy to start
                automating return decisions.
              </p>
            </Banner>
          ) : (
            policies.map((p) => (
              <PolicyCard key={p.id} policy={p} onEdit={openEdit} />
            ))
          )}
        </Layout.Section>
      </Layout>

      <Modal
        open={active}
        onClose={closeModal}
        title={isNew ? "Create Policy" : "Edit Policy"}
      >
        <Modal.Section>
          <fetcher.Form method="post">
            <input
              type="hidden"
              name="_action"
              value={isNew ? "create" : "update"}
            />
            {!isNew && <input type="hidden" name="id" value={editing.id} />}
            <input type="hidden" name="isActive" value="true" />

            <BlockStack gap="400">
              <TextField
                label="Policy Name"
                name="name"
                defaultValue={editing?.name || ""}
                required
                autoComplete="off"
              />

              <TextField
                label="Description"
                name="description"
                defaultValue={editing?.description || ""}
                multiline={2}
                autoComplete="off"
              />

              <TextField
                label="Priority (lower = checked first)"
                name="priority"
                type="number"
                defaultValue={String(editing?.priority ?? 0)}
                autoComplete="off"
              />

              <TextField
                label="Max Days for Return"
                name="maxDays"
                type="number"
                defaultValue={String(
                  c.find((x: any) => x.field === "maxDays")?.value ?? 30
                )}
                autoComplete="off"
              />

              <TextField
                label="Max Amount for Auto-approve ($)"
                name="maxAmount"
                type="number"
                prefix="$"
                step="0.01"
                defaultValue={String(
                  c.find((x: any) => x.field === "maxAmount")?.value ?? 9999
                )}
                autoComplete="off"
              />

              <Checkbox
                label="Auto-approve returns matching this policy"
                name="autoApprove"
                defaultChecked={
                  c.find((x: any) => x.field === "autoApprove")?.value === true
                }
              />

              <TextField
                label="Restocking Fee (%)"
                name="restockingFee"
                type="number"
                suffix="%"
                step="0.5"
                defaultValue={String(
                  c.find((x: any) => x.field === "restockingFee")?.value ?? 0
                )}
                autoComplete="off"
              />

              <Checkbox
                label="Require return label"
                name="requiresReturnLabel"
                defaultChecked={
                  c.find((x: any) => x.field === "requiresReturnLabel")
                    ?.value === true
                }
              />

              <Button submit variant="primary">
                {isNew ? "Create Policy" : "Update Policy"}
              </Button>
            </BlockStack>
          </fetcher.Form>
        </Modal.Section>
      </Modal>
    </Page>
  );
}