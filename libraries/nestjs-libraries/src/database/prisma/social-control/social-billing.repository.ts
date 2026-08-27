import { Injectable } from '@nestjs/common';
import {
  Period,
  Prisma,
  SaasSubscriptionState,
  SubscriptionTier,
} from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { SocialBillingEventDto } from '@gitroom/nestjs-libraries/dtos/social-control/social-billing-event.dto';

export type ApplyBillingEvent = {
  tenantId: string;
  correlationId: string;
  idempotencyKey: string;
  payloadHash: string;
  occurredAt: Date;
  tier: SubscriptionTier;
  channels: number;
  state: SaasSubscriptionState;
  period: Period;
  input: SocialBillingEventDto;
};

@Injectable()
export class SocialBillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findEvent(tenantId: string, idempotencyKey: string) {
    return this.prisma.socialBillingEventInbox.findFirst({
      where: { tenantId, idempotencyKey },
    });
  }

  subscription(tenantId: string) {
    return this.prisma.subscription.findUnique({
      where: { organizationId: tenantId },
    });
  }

  apply(input: ApplyBillingEvent) {
    return this.prisma.$transaction(async (transaction) => {
      const inbox = await transaction.socialBillingEventInbox.create({
        data: {
          tenantId: input.tenantId,
          providerEventId: input.input.provider_event_id,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
          eventType: input.input.event_type,
          occurredAt: input.occurredAt,
          providerCustomerId: input.input.customer_id,
          providerSubscriptionId: input.input.subscription_id,
          normalized: input.input as unknown as Prisma.InputJsonObject,
          correlationId: input.correlationId,
        },
      });
      await transaction.organization.update({
        where: { id: input.tenantId },
        data: { paymentId: input.input.customer_id },
      });
      const subscription = await transaction.subscription.upsert({
        where: { organizationId: input.tenantId },
        create: {
          organizationId: input.tenantId,
          subscriptionTier: input.tier,
          identifier: input.input.subscription_id,
          period: input.period,
          totalChannels: input.channels,
          state: input.state,
          catalogVersion: input.input.catalog_version,
          planCode: input.input.plan_code,
          seatQuantity: input.input.seat_quantity,
          entitlements: input.input.entitlements as Prisma.InputJsonObject,
          currentPeriodStart: new Date(input.input.current_period_start),
          currentPeriodEnd: new Date(input.input.current_period_end),
          graceUntil: input.input.grace_until
            ? new Date(input.input.grace_until)
            : null,
          cancelAtPeriodEnd: input.input.cancel_at_period_end,
          providerUpdatedAt: input.occurredAt,
          lastProviderEventId: input.input.provider_event_id,
        },
        update: {
          subscriptionTier: input.tier,
          identifier: input.input.subscription_id,
          period: input.period,
          totalChannels: input.channels,
          state: input.state,
          catalogVersion: input.input.catalog_version,
          planCode: input.input.plan_code,
          seatQuantity: input.input.seat_quantity,
          entitlements: input.input.entitlements as Prisma.InputJsonObject,
          currentPeriodStart: new Date(input.input.current_period_start),
          currentPeriodEnd: new Date(input.input.current_period_end),
          graceUntil: input.input.grace_until
            ? new Date(input.input.grace_until)
            : null,
          cancelAtPeriodEnd: input.input.cancel_at_period_end,
          providerUpdatedAt: input.occurredAt,
          lastProviderEventId: input.input.provider_event_id,
          deletedAt: null,
        },
      });
      await transaction.socialBillingEventInbox.update({
        where: { id: inbox.id },
        data: { state: 'APPLIED', processedAt: new Date() },
      });
      await transaction.socialOutboxEvent.create({
        data: {
          tenantId: input.tenantId,
          eventType: 'social.subscription.changed',
          eventVersion: '2.0',
          occurredAt: input.occurredAt,
          correlationId: input.correlationId,
          causationId: inbox.id,
          idempotencyKey: `social.subscription.changed:${inbox.id}`,
          payload: {
            subscription_id: subscription.id,
            plan_code: subscription.planCode,
            state: subscription.state.toLowerCase(),
            period: subscription.period.toLowerCase(),
            seat_quantity: subscription.seatQuantity,
            current_period_end: subscription.currentPeriodEnd?.toISOString(),
          },
          metadata: { source: 'codestra-social', provider: 'stripe' },
        },
      });
      return { inbox, subscription };
    });
  }
}
