import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe("DELETE FROM \"FraudSignal\"");
  await prisma.$executeRawUnsafe("DELETE FROM \"DecisionLog\"");
  await prisma.$executeRawUnsafe("DELETE FROM \"ReturnRequest\"");
  await prisma.$executeRawUnsafe("DELETE FROM \"Policy\"");
  console.log("Cleaned: FraudSignal, DecisionLog, ReturnRequest, Policy");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());