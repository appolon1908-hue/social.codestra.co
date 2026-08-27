import crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SaasSubscriptionState, SubscriptionTier } from '@prisma/client';
import { ServiceAuthContext } from '@gitroom/nestjs-libraries/security/service-auth/service-auth.types';
import { SocialBillingEventDto } from '@gitroom/nestjs-libraries/dtos/social-control/social-billing-event.dto';
import { SocialBillingRepository } from './social-billing.repository';

const PLAN: Record<string, { tier: SubscriptionTier; channels: number }> = {
  starter: { tier: 'STANDARD', channels: 5 },
  professional: { tier: 'PRO', channels: 20 },
  agency: { tier: 'TEAM', channels: 100 },
  enterprise: { tier: 'ULTIMATE', channels: 500 },
};

@Injectable()
export class SocialBillingService {
  constructor(private readonly repository: SocialBillingRepository) {}

  async accept(
    auth: ServiceAuthContext,
    idempotencyKey: string | undefined,
    input: SocialBillingEventDto
  ) {
    if (
      !idempotencyKey ||
      idempotencyKey.length < 16 ||
      idempotencyKey.length > 200
    ) {
      throw new BadRequestException('valid_idempotency_key_required');
    }
    const payloadHash = this.hash(input);
    const replay = await this.repository.findEvent(
      auth.tenantId,
      idempotencyKey
    );
    if (replay) {
      if (replay.payloadHash !== payloadHash) {
        throw new ConflictException('idempotency_payload_conflict');
      }
      return {
        event_id: replay.id,
        state: replay.state.toLowerCase(),
        replayed: true,
      };
    }
    const occurredAt = new Date(input.occurred_at);
    const current = await this.repository.subscription(auth.tenantId);
    if (current?.providerUpdatedAt && occurredAt <= current.providerUpdatedAt) {
      throw new ConflictException('stale_billing_event');
    }
    if (
      new Date(input.current_period_end) <= new Date(input.current_period_start)
    ) {
      throw new UnprocessableEntityException('invalid_billing_period');
    }
    if (input.status === 'grace' && !input.grace_until) {
      throw new UnprocessableEntityException('grace_until_required');
    }
    const plan = PLAN[input.plan_code];
    const applied = await this.repository.apply({
      tenantId: auth.tenantId,
      correlationId: auth.correlationId,
      idempotencyKey,
      payloadHash,
      occurredAt,
      tier: plan.tier,
      channels: plan.channels,
      state: input.status.toUpperCase() as SaasSubscriptionState,
      period: input.period.toUpperCase() as 'MONTHLY' | 'YEARLY',
      input,
    });
    return {
      event_id: applied.inbox.id,
      subscription_id: applied.subscription.id,
      state: applied.subscription.state.toLowerCase(),
      plan_code: applied.subscription.planCode,
      replayed: false,
      publishing_changed: false,
    };
  }

  private hash(input: SocialBillingEventDto) {
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
