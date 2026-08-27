CREATE TYPE "SaasSubscriptionState" AS ENUM (
  'TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE', 'PAUSED',
  'CANCEL_AT_PERIOD_END', 'CANCELED', 'INCOMPLETE'
);
CREATE TYPE "SocialBillingInboxState" AS ENUM ('RECEIVED', 'APPLIED', 'REJECTED');

ALTER TABLE "Subscription"
  ADD COLUMN "state" "SaasSubscriptionState" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "catalogVersion" TEXT NOT NULL DEFAULT 'legacy-v1',
  ADD COLUMN "planCode" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "seatQuantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "entitlements" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "currentPeriodStart" TIMESTAMP(3),
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "graceUntil" TIMESTAMP(3),
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "providerUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "lastProviderEventId" TEXT;

CREATE TABLE "SocialBillingEventInbox" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "providerCustomerId" TEXT NOT NULL,
  "providerSubscriptionId" TEXT,
  "state" "SocialBillingInboxState" NOT NULL DEFAULT 'RECEIVED',
  "errorCode" TEXT,
  "normalized" JSONB NOT NULL,
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "SocialBillingEventInbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialBillingEventInbox_providerEventId_key"
  ON "SocialBillingEventInbox"("providerEventId");
CREATE UNIQUE INDEX "SocialBillingEventInbox_tenantId_idempotencyKey_key"
  ON "SocialBillingEventInbox"("tenantId", "idempotencyKey");
CREATE INDEX "SocialBillingEventInbox_tenantId_occurredAt_idx"
  ON "SocialBillingEventInbox"("tenantId", "occurredAt");
CREATE INDEX "SocialBillingEventInbox_state_createdAt_idx"
  ON "SocialBillingEventInbox"("state", "createdAt");

ALTER TABLE "SocialBillingEventInbox"
  ADD CONSTRAINT "SocialBillingEventInbox_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
