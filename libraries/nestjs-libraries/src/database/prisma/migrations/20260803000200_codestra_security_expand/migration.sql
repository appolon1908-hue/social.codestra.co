-- CreateEnum
CREATE TYPE "WebhookDeliveryState" AS ENUM ('PENDING', 'DELIVERING', 'RETRY_WAIT', 'DELIVERED', 'DEAD_LETTER', 'CANCELLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN     "securityVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "refreshCiphertext" TEXT,
ADD COLUMN     "refreshKeyVersion" INTEGER,
ADD COLUMN     "refreshNonce" TEXT,
ADD COLUMN     "customDetailsCiphertext" TEXT,
ADD COLUMN     "customDetailsKeyVersion" INTEGER,
ADD COLUMN     "customDetailsNonce" TEXT,
ADD COLUMN     "tokenCiphertext" TEXT,
ADD COLUMN     "tokenKeyVersion" INTEGER,
ADD COLUMN     "tokenNonce" TEXT;

-- AlterTable
ALTER TABLE "OAuthApp" ADD COLUMN     "clientSecretCiphertext" TEXT,
ADD COLUMN     "clientSecretKeyVersion" INTEGER,
ADD COLUMN     "clientSecretNonce" TEXT;

-- AlterTable
ALTER TABLE "OAuthAuthorization" ADD COLUMN     "accessTokenCiphertext" TEXT,
ADD COLUMN     "accessTokenHash" TEXT,
ADD COLUMN     "accessTokenKeyVersion" INTEGER,
ADD COLUMN     "accessTokenNonce" TEXT,
ADD COLUMN     "authorizationCodeHash" TEXT;

-- AlterTable
ALTER TABLE "ThirdParty" ADD COLUMN "apiKeyCiphertext" TEXT,
ADD COLUMN "apiKeyNonce" TEXT,
ADD COLUMN "apiKeyKeyVersion" INTEGER;

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tokenFamilyId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "previousTokenHash" TEXT,
    "usedRefreshTokenHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recentAuthAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "deviceLabel" TEXT,
    "ipFingerprint" TEXT,
    "userAgentFingerprint" TEXT,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRefreshTokenHistory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthRefreshTokenHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationApiKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "ratePolicy" TEXT,

    CONSTRAINT "OrganizationApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "eventTypes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookSecretVersion" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookSecretVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "state" "WebhookDeliveryState" NOT NULL DEFAULT 'PENDING',
    "nextAttemptAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "responseCode" INTEGER,
    "errorCode" TEXT,
    "responseBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDeadLetter" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookDeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookReplayAudit" (
    "id" TEXT NOT NULL,
    "deadLetterId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookReplayAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_organizationId_revokedAt_idx" ON "AuthSession"("organizationId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_tokenFamilyId_idx" ON "AuthSession"("tokenFamilyId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthRefreshTokenHistory_tokenHash_key" ON "AuthRefreshTokenHistory"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthRefreshTokenHistory_sessionId_usedAt_idx" ON "AuthRefreshTokenHistory"("sessionId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationApiKey_keyHash_key" ON "OrganizationApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "OrganizationApiKey_organizationId_revokedAt_idx" ON "OrganizationApiKey"("organizationId", "revokedAt");

-- CreateIndex
CREATE INDEX "OrganizationApiKey_fingerprint_idx" ON "OrganizationApiKey"("fingerprint");

-- CreateIndex
CREATE INDEX "WebhookSubscription_organizationId_enabled_deletedAt_idx" ON "WebhookSubscription"("organizationId", "enabled", "deletedAt");

-- CreateIndex
CREATE INDEX "WebhookSecretVersion_subscriptionId_activeFrom_expiresAt_idx" ON "WebhookSecretVersion"("subscriptionId", "activeFrom", "expiresAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_organizationId_createdAt_idx" ON "WebhookEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDeliveryAttempt_state_nextAttemptAt_idx" ON "WebhookDeliveryAttempt"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WebhookDeliveryAttempt_subscriptionId_createdAt_idx" ON "WebhookDeliveryAttempt"("subscriptionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDeliveryAttempt_eventId_subscriptionId_attempt_key" ON "WebhookDeliveryAttempt"("eventId", "subscriptionId", "attempt");

-- CreateIndex
CREATE INDEX "WebhookDeadLetter_subscriptionId_resolvedAt_idx" ON "WebhookDeadLetter"("subscriptionId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDeadLetter_eventId_subscriptionId_key" ON "WebhookDeadLetter"("eventId", "subscriptionId");

-- CreateIndex
CREATE INDEX "WebhookReplayAudit_deadLetterId_createdAt_idx" ON "WebhookReplayAudit"("deadLetterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorization_accessTokenHash_key" ON "OAuthAuthorization"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorization_authorizationCodeHash_key" ON "OAuthAuthorization"("authorizationCodeHash");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthRefreshTokenHistory" ADD CONSTRAINT "AuthRefreshTokenHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationApiKey" ADD CONSTRAINT "OrganizationApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSecretVersion" ADD CONSTRAINT "WebhookSecretVersion_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDeliveryAttempt" ADD CONSTRAINT "WebhookDeliveryAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "WebhookEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDeliveryAttempt" ADD CONSTRAINT "WebhookDeliveryAttempt_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDeadLetter" ADD CONSTRAINT "WebhookDeadLetter_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookReplayAudit" ADD CONSTRAINT "WebhookReplayAudit_deadLetterId_fkey" FOREIGN KEY ("deadLetterId") REFERENCES "WebhookDeadLetter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
