// One-time script to upgrade shopigent-kosmos to Pro plan
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.shop.upsert({
    where: { shop: "shopigent-kosmos.myshopify.com" },
    update: { planName: "pro", planStatus: "active" },
    create: {
      id: "shopigent-kosmos.myshopify.com",
      shop: "shopigent-kosmos.myshopify.com",
      planName: "pro",
      planStatus: "active",
    },
  });
  console.log(`✅ ${shop.shop} → Pro (${shop.planName})`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});