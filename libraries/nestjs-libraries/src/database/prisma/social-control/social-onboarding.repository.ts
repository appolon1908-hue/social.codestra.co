import { Injectable } from '@nestjs/common';
import { Prisma, SocialOnboardingState } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

export type AdvanceOnboarding = {
  tenantId: string;
  correlationId: string;
  idempotencyKey: string;
  payloadHash: string;
  actor: string;
  fromState: SocialOnboardingState;
  toState: SocialOnboardingState;
  evidence: Prisma.InputJsonObject;
  expectedVersion: number;
};

@Injectable()
export class SocialOnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

  getOrCreate(tenantId: string) {
    return this.prisma.socialTenantOnboarding.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
      include: { transitions: { orderBy: { createdAt: 'asc' } } },
    });
  }

  findTransition(tenantId: string, idempotencyKey: string) {
    return this.prisma.socialOnboardingTransition.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      include: { onboarding: true },
    });
  }

  advance(input: AdvanceOnboarding) {
    return this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.socialTenantOnboarding.updateMany({
        where: {
          tenantId: input.tenantId,
          state: input.fromState,
          version: input.expectedVersion,
        },
        data: {
          state: input.toState,
          readiness: input.evidence,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new Error('onboarding_version_conflict');
      const onboarding =
        await transaction.socialTenantOnboarding.findUniqueOrThrow({
          where: { tenantId: input.tenantId },
        });
      const transition = await transaction.socialOnboardingTransition.create({
        data: {
          tenantId: input.tenantId,
          onboardingId: onboarding.id,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
          correlationId: input.correlationId,
          actor: input.actor,
          fromState: input.fromState,
          toState: input.toState,
          evidence: input.evidence,
        },
      });
      await transaction.socialOutboxEvent.create({
        data: {
          tenantId: input.tenantId,
          eventType: 'social.onboarding.advanced',
          eventVersion: '2.0',
          occurredAt: new Date(),
          correlationId: input.correlationId,
          causationId: transition.id,
          idempotencyKey: `social.onboarding.advanced:${transition.id}`,
          payload: {
            onboarding_id: onboarding.id,
            from_state: input.fromState.toLowerCase(),
            to_state: input.toState.toLowerCase(),
            version: onboarding.version,
          },
          metadata: { source: 'codestra-social' },
        },
      });
      return { onboarding, transition };
    });
  }
}
