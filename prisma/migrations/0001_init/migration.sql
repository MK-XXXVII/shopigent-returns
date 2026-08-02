-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXCHANGE', 'SHIPPED', 'REFUNDED', 'CLOSED');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN,
    "emailVerified" BOOLEAN,
    "onlineAccessInfo" JSONB,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "reason" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'PENDING',
    "aiDecision" JSONB,
    "aiConfidence" DOUBLE PRECISION,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "labels" JSONB NOT NULL DEFAULT '[]',
    "refundAmount" DECIMAL(10,2),
    "refundId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudSignal" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "domain" TEXT,
    "planName" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "mcpApiKeyHash" TEXT,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_shop_idx" ON "Session"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Session_shop_isOnline_key" ON "Session"("shop", "isOnline");

-- CreateIndex
CREATE INDEX "ReturnRequest_shop_idx" ON "ReturnRequest"("shop");

-- CreateIndex
CREATE INDEX "ReturnRequest_shop_status_idx" ON "ReturnRequest"("shop", "status");

-- CreateIndex
CREATE INDEX "ReturnRequest_shop_createdAt_idx" ON "ReturnRequest"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "Policy_shop_idx" ON "Policy"("shop");

-- CreateIndex
CREATE INDEX "Policy_shop_isActive_idx" ON "Policy"("shop", "isActive");

-- CreateIndex
CREATE INDEX "FraudSignal_returnId_idx" ON "FraudSignal"("returnId");

-- CreateIndex
CREATE INDEX "DecisionLog_returnId_idx" ON "DecisionLog"("returnId");

-- CreateIndex
CREATE INDEX "DecisionLog_returnId_createdAt_idx" ON "DecisionLog"("returnId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shop_key" ON "Shop"("shop");

-- CreateIndex
CREATE INDEX "Shop_shop_idx" ON "Shop"("shop");

-- AddForeignKey
ALTER TABLE "FraudSignal" ADD CONSTRAINT "FraudSignal_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLog" ADD CONSTRAINT "DecisionLog_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

