// Create 3 example policies for the demo store
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const shop = "shopigent-kosmos.myshopify.com";

const policies = [
  {
    shop,
    name: "Standard 30-Day Return",
    description: "Default return policy for most products. Items under $200 are auto-approved.",
    priority: 1,
    isActive: true,
    conditions: [
      { field: "maxDays", operator: "lte", value: 30 },
      { field: "maxAmount", operator: "lte", value: 200 },
    ],
    autoApprove: true,
    restockingFee: 0,
  },
  {
    shop,
    name: "High-Value Review",
    description: "Items over $200 require manual review by store staff.",
    priority: 2,
    isActive: true,
    conditions: [
      { field: "maxDays", operator: "lte", value: 30 },
      { field: "minAmount", operator: "gt", value: 200 },
    ],
    autoApprove: false,
    restockingFee: 10,
  },
  {
    shop,
    name: "Final Sale - Electronics",
    description: "Electronics and clearance items are non-returnable.",
    priority: 3,
    isActive: true,
    conditions: [
      { field: "maxDays", operator: "lte", value: 0 },
    ],
    autoApprove: false,
    restockingFee: 0,
  },
];

async function main() {
  for (const p of policies) {
    const existing = await prisma.policy.findFirst({
      where: { shop: p.shop, name: p.name },
    });
    if (existing) {
      await prisma.policy.update({
        where: { id: existing.id },
        data: { ...p },
      });
      console.log(`✅ Updated: ${p.name}`);
    } else {
      await prisma.policy.create({ data: p });
      console.log(`✅ Created: ${p.name}`);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});