-- Durable, replay-safe inbox for product-local provider worker callbacks.
CREATE TYPE "SocialProviderInboxState" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

CREATE TABLE "SocialProviderInbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "state" "SocialProviderInboxState" NOT NULL DEFAULT 'RECEIVED',
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialProviderInbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialProviderInbox_tenantId_provider_providerEventId_key"
    ON "SocialProviderInbox"("tenantId", "provider", "providerEventId");
CREATE INDEX "SocialProviderInbox_state_receivedAt_idx"
    ON "SocialProviderInbox"("state", "receivedAt");
CREATE INDEX "SocialProviderInbox_tenantId_provider_occurredAt_idx"
    ON "SocialProviderInbox"("tenantId", "provider", "occurredAt");
CREATE INDEX "SocialProviderInbox_correlationId_idx"
    ON "SocialProviderInbox"("correlationId");

ALTER TABLE "SocialProviderInbox"
    ADD CONSTRAINT "SocialProviderInbox_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
