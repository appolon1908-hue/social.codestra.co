CREATE TYPE "SocialCommandState" AS ENUM (
  'REQUESTED', 'PERSISTED', 'QUEUED', 'BLOCKED', 'IN_PROGRESS',
  'COMPLETED', 'FAILED', 'DEAD_LETTERED', 'CANCELLED'
);

CREATE TYPE "SocialDeliveryState" AS ENUM (
  'PENDING', 'BLOCKED', 'PUBLISHING', 'PROVIDER_ACCEPTED', 'PUBLISHED',
  'RETRY_WAIT', 'FAILED', 'DEAD_LETTERED', 'CANCELLED'
);

CREATE TYPE "SocialOutboxState" AS ENUM (
  'PENDING', 'LEASED', 'RETRY_WAIT', 'DELIVERED', 'DEAD_LETTERED'
);

CREATE TABLE "SocialPublicationCommand" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "commandVersion" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "mediaIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB NOT NULL,
  "scheduleAt" TIMESTAMP(3),
  "state" "SocialCommandState" NOT NULL DEFAULT 'REQUESTED',
  "publishingEnabledAtAcceptance" BOOLEAN NOT NULL DEFAULT false,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialPublicationCommand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialDelivery" (
  "id" TEXT NOT NULL,
  "commandId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "settings" JSONB NOT NULL,
  "state" "SocialDeliveryState" NOT NULL DEFAULT 'PENDING',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "providerPostId" TEXT,
  "errorCode" TEXT,
  "nextAttemptAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "reconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialOutboxEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventVersion" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "correlationId" TEXT NOT NULL,
  "causationId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "metadata" JSONB NOT NULL,
  "state" "SocialOutboxState" NOT NULL DEFAULT 'PENDING',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialPublicationCommand_tenantId_idempotencyKey_key"
  ON "SocialPublicationCommand"("tenantId", "idempotencyKey");
CREATE INDEX "SocialPublicationCommand_tenantId_state_createdAt_idx"
  ON "SocialPublicationCommand"("tenantId", "state", "createdAt");
CREATE INDEX "SocialPublicationCommand_correlationId_idx"
  ON "SocialPublicationCommand"("correlationId");
CREATE INDEX "SocialPublicationCommand_scheduleAt_state_idx"
  ON "SocialPublicationCommand"("scheduleAt", "state");

CREATE UNIQUE INDEX "SocialDelivery_commandId_accountId_key"
  ON "SocialDelivery"("commandId", "accountId");
CREATE INDEX "SocialDelivery_tenantId_state_nextAttemptAt_idx"
  ON "SocialDelivery"("tenantId", "state", "nextAttemptAt");
CREATE INDEX "SocialDelivery_accountId_createdAt_idx"
  ON "SocialDelivery"("accountId", "createdAt");
CREATE INDEX "SocialDelivery_providerPostId_idx"
  ON "SocialDelivery"("providerPostId");

CREATE UNIQUE INDEX "SocialOutboxEvent_tenantId_idempotencyKey_key"
  ON "SocialOutboxEvent"("tenantId", "idempotencyKey");
CREATE INDEX "SocialOutboxEvent_state_nextAttemptAt_createdAt_idx"
  ON "SocialOutboxEvent"("state", "nextAttemptAt", "createdAt");
CREATE INDEX "SocialOutboxEvent_tenantId_eventType_createdAt_idx"
  ON "SocialOutboxEvent"("tenantId", "eventType", "createdAt");
CREATE INDEX "SocialOutboxEvent_correlationId_idx"
  ON "SocialOutboxEvent"("correlationId");

ALTER TABLE "SocialPublicationCommand"
  ADD CONSTRAINT "SocialPublicationCommand_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialDelivery"
  ADD CONSTRAINT "SocialDelivery_commandId_fkey"
  FOREIGN KEY ("commandId") REFERENCES "SocialPublicationCommand"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialDelivery"
  ADD CONSTRAINT "SocialDelivery_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Integration"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialOutboxEvent"
  ADD CONSTRAINT "SocialOutboxEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
