CREATE TYPE "SocialAiGenerationState" AS ENUM (
  'REQUESTED', 'BLOCKED', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED'
);

CREATE TABLE "SocialBrandProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "activeRevisionNumber" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialBrandProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SocialBrandRevision" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "voice" JSONB NOT NULL,
  "audience" JSONB NOT NULL,
  "visualRules" JSONB NOT NULL,
  "prohibitedTopics" TEXT[],
  "prohibitedClaims" TEXT[],
  "requiredDisclaimers" TEXT[],
  "locales" TEXT[],
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialBrandRevision_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SocialAiGeneration" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "brandRevisionId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "sources" JSONB NOT NULL,
  "modelPolicy" JSONB NOT NULL,
  "riskFindings" JSONB NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "state" "SocialAiGenerationState" NOT NULL,
  "output" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialAiGeneration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialBrandProfile_tenantId_name_key" ON "SocialBrandProfile"("tenantId", "name");
CREATE INDEX "SocialBrandProfile_tenantId_updatedAt_idx" ON "SocialBrandProfile"("tenantId", "updatedAt");
CREATE UNIQUE INDEX "SocialBrandRevision_brandId_revisionNumber_key" ON "SocialBrandRevision"("brandId", "revisionNumber");
CREATE INDEX "SocialBrandRevision_tenantId_createdAt_idx" ON "SocialBrandRevision"("tenantId", "createdAt");
CREATE UNIQUE INDEX "SocialAiGeneration_tenantId_idempotencyKey_key" ON "SocialAiGeneration"("tenantId", "idempotencyKey");
CREATE INDEX "SocialAiGeneration_tenantId_state_createdAt_idx" ON "SocialAiGeneration"("tenantId", "state", "createdAt");

ALTER TABLE "SocialBrandProfile" ADD CONSTRAINT "SocialBrandProfile_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialBrandRevision" ADD CONSTRAINT "SocialBrandRevision_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "SocialBrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialAiGeneration" ADD CONSTRAINT "SocialAiGeneration_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialAiGeneration" ADD CONSTRAINT "SocialAiGeneration_brandRevisionId_fkey"
  FOREIGN KEY ("brandRevisionId") REFERENCES "SocialBrandRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
