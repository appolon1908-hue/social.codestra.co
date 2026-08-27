CREATE TYPE "SocialOnboardingState" AS ENUM (
  'CREATED',
  'IDENTITY_VERIFIED',
  'WORKSPACE_CONFIGURED',
  'BRAND_READY',
  'ACCOUNTS_CONNECTED',
  'POLICY_READY',
  'DRY_RUN_PASSED',
  'READY_FOR_ACTIVATION'
);

CREATE TABLE "SocialTenantOnboarding" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "state" "SocialOnboardingState" NOT NULL DEFAULT 'CREATED',
  "readiness" JSONB NOT NULL DEFAULT '{}',
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialTenantOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialOnboardingTransition" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "onboardingId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "fromState" "SocialOnboardingState" NOT NULL,
  "toState" "SocialOnboardingState" NOT NULL,
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialOnboardingTransition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialTenantOnboarding_tenantId_key"
  ON "SocialTenantOnboarding"("tenantId");
CREATE INDEX "SocialTenantOnboarding_state_updatedAt_idx"
  ON "SocialTenantOnboarding"("state", "updatedAt");
CREATE UNIQUE INDEX "SocialOnboardingTransition_tenantId_idempotencyKey_key"
  ON "SocialOnboardingTransition"("tenantId", "idempotencyKey");
CREATE INDEX "SocialOnboardingTransition_tenantId_createdAt_idx"
  ON "SocialOnboardingTransition"("tenantId", "createdAt");
CREATE INDEX "SocialOnboardingTransition_onboardingId_createdAt_idx"
  ON "SocialOnboardingTransition"("onboardingId", "createdAt");

ALTER TABLE "SocialTenantOnboarding"
  ADD CONSTRAINT "SocialTenantOnboarding_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialOnboardingTransition"
  ADD CONSTRAINT "SocialOnboardingTransition_onboardingId_fkey"
  FOREIGN KEY ("onboardingId") REFERENCES "SocialTenantOnboarding"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
