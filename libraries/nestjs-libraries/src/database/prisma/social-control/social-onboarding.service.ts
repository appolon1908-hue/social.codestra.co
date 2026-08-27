import crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, SocialOnboardingState } from '@prisma/client';
import { ServiceAuthContext } from '@gitroom/nestjs-libraries/security/service-auth/service-auth.types';
import { SocialOnboardingTransitionDto } from '@gitroom/nestjs-libraries/dtos/social-control/social-onboarding.dto';
import { SocialOnboardingRepository } from './social-onboarding.repository';

const NEXT: Record<SocialOnboardingState, SocialOnboardingState | null> = {
  CREATED: 'IDENTITY_VERIFIED',
  IDENTITY_VERIFIED: 'WORKSPACE_CONFIGURED',
  WORKSPACE_CONFIGURED: 'BRAND_READY',
  BRAND_READY: 'ACCOUNTS_CONNECTED',
  ACCOUNTS_CONNECTED: 'POLICY_READY',
  POLICY_READY: 'DRY_RUN_PASSED',
  DRY_RUN_PASSED: 'READY_FOR_ACTIVATION',
  READY_FOR_ACTIVATION: null,
};

@Injectable()
export class SocialOnboardingService {
  constructor(private readonly repository: SocialOnboardingRepository) {}

  async get(auth: ServiceAuthContext) {
    const onboarding = await this.repository.getOrCreate(auth.tenantId);
    return this.response(onboarding, false);
  }

  async advance(
    auth: ServiceAuthContext,
    idempotencyKey: string | undefined,
    input: SocialOnboardingTransitionDto
  ) {
    if (
      !idempotencyKey ||
      idempotencyKey.length < 16 ||
      idempotencyKey.length > 200
    ) {
      throw new BadRequestException('valid_idempotency_key_required');
    }
    const payloadHash = this.hash(input);
    const replay = await this.repository.findTransition(
      auth.tenantId,
      idempotencyKey
    );
    if (replay) {
      if (replay.payloadHash !== payloadHash) {
        throw new ConflictException('idempotency_payload_conflict');
      }
      return this.response(replay.onboarding, true);
    }

    const current = await this.repository.getOrCreate(auth.tenantId);
    const requested = input.to_state.toUpperCase() as SocialOnboardingState;
    if (NEXT[current.state] !== requested) {
      throw new UnprocessableEntityException(
        `invalid_onboarding_transition:${current.state.toLowerCase()}:${
          input.to_state
        }`
      );
    }
    if (!Object.keys(input.evidence).length) {
      throw new UnprocessableEntityException('onboarding_evidence_required');
    }

    try {
      const advanced = await this.repository.advance({
        tenantId: auth.tenantId,
        correlationId: auth.correlationId,
        idempotencyKey,
        payloadHash,
        actor: input.requested_by,
        fromState: current.state,
        toState: requested,
        evidence: input.evidence as Prisma.InputJsonObject,
        expectedVersion: current.version,
      });
      return this.response(advanced.onboarding, false);
    } catch (error) {
      if ((error as Error).message === 'onboarding_version_conflict') {
        throw new ConflictException('onboarding_version_conflict');
      }
      throw error;
    }
  }

  private response(
    onboarding: {
      id: string;
      state: SocialOnboardingState;
      readiness: unknown;
      version: number;
      createdAt: Date;
      updatedAt: Date;
    },
    replayed: boolean
  ) {
    return {
      onboarding_id: onboarding.id,
      state: onboarding.state.toLowerCase(),
      next_state: NEXT[onboarding.state]?.toLowerCase() ?? null,
      readiness: onboarding.readiness,
      version: onboarding.version,
      idempotency_replayed: replayed,
      activation_automatic: false,
      created_at: onboarding.createdAt,
      updated_at: onboarding.updatedAt,
    };
  }

  private hash(input: SocialOnboardingTransitionDto) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(this.canonical(input)))
      .digest('hex');
  }

  private canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.canonical(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, this.canonical(item)])
      );
    }
    return value;
  }
}
