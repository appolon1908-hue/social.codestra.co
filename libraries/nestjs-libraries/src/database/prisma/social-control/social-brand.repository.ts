import { Injectable } from '@nestjs/common';
import { Prisma, SocialAiGenerationState } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  SocialAiGenerationRequestDto,
  SocialBrandCreateDto,
} from '@gitroom/nestjs-libraries/dtos/social-control/social-brand.dto';

@Injectable()
export class SocialBrandRepository {
  constructor(private readonly prisma: PrismaService) {}

  createBrand(tenantId: string, input: SocialBrandCreateDto) {
    return this.prisma.socialBrandProfile.create({
      data: {
        tenantId,
        name: input.name,
        revisions: {
          create: {
            tenantId,
            revisionNumber: 1,
            createdBy: input.requested_by,
            voice: input.voice as Prisma.InputJsonObject,
            audience: input.audience as Prisma.InputJsonObject,
            visualRules: input.visual_rules as Prisma.InputJsonObject,
            prohibitedTopics: input.prohibited_topics,
            prohibitedClaims: input.prohibited_claims,
            requiredDisclaimers: input.required_disclaimers,
            locales: input.locales,
          },
        },
      },
      include: { revisions: true },
    });
  }

  brand(tenantId: string, id: string) {
    return this.prisma.socialBrandProfile.findFirst({
      where: { id, tenantId },
      include: { revisions: true },
    });
  }

  revision(tenantId: string, id: string) {
    return this.prisma.socialBrandRevision.findFirst({
      where: { id, tenantId },
    });
  }

  generationByIdempotency(tenantId: string, idempotencyKey: string) {
    return this.prisma.socialAiGeneration.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
  }

  async createGeneration(input: {
    tenantId: string;
    correlationId: string;
    idempotencyKey: string;
    payloadHash: string;
    request: SocialAiGenerationRequestDto;
    riskScore: number;
    findings: string[];
    state: SocialAiGenerationState;
  }) {
    return this.prisma.$transaction(async (transaction) => {
      const generation = await transaction.socialAiGeneration.create({
        data: {
          tenantId: input.tenantId,
          brandRevisionId: input.request.brand_revision_id,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
          correlationId: input.correlationId,
          requestedBy: input.request.requested_by,
          objective: input.request.objective,
          prompt: input.request.prompt,
          sources: input.request.sources as Prisma.InputJsonArray,
          modelPolicy: input.request.model_policy as Prisma.InputJsonObject,
          riskFindings: input.findings,
          riskScore: input.riskScore,
          state: input.state,
        },
      });
      await transaction.socialOutboxEvent.create({
        data: {
          tenantId: input.tenantId,
          eventType: 'social.ai.generation.requested',
          eventVersion: '2.0',
          occurredAt: new Date(),
          correlationId: input.correlationId,
          causationId: generation.id,
          idempotencyKey: `social.ai.generation.requested:${generation.id}`,
          payload: {
            generation_id: generation.id,
            brand_revision_id: generation.brandRevisionId,
            risk_score: generation.riskScore,
            state: generation.state.toLowerCase(),
          },
          metadata: { source: 'codestra-social' },
        },
      });
      return generation;
    });
  }
}
