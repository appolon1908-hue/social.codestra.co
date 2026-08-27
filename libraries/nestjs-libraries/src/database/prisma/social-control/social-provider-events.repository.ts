import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SocialCommandState,
  SocialDeliveryState,
} from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { SocialProviderEventDto } from '@gitroom/nestjs-libraries/dtos/social-control/social-provider-event.dto';

export type ProcessSocialProviderEvent = {
  tenantId: string;
  provider: string;
  correlationId: string;
  payloadHash: string;
  input: SocialProviderEventDto;
};

@Injectable()
export class SocialProviderEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findInbox(tenantId: string, provider: string, providerEventId: string) {
    return this.prisma.socialProviderInbox.findUnique({
      where: {
        tenantId_provider_providerEventId: {
          tenantId,
          provider,
          providerEventId,
        },
      },
    });
  }

  process(input: ProcessSocialProviderEvent) {
    return this.prisma.$transaction(async (transaction) => {
      const inbox = await transaction.socialProviderInbox.create({
        data: {
          tenantId: input.tenantId,
          provider: input.provider,
          providerEventId: input.input.event_id,
          eventType: input.input.event_type,
          eventVersion: input.input.event_version,
          occurredAt: new Date(input.input.occurred_at),
          correlationId: input.correlationId,
          payloadHash: input.payloadHash,
          payload: input.input as unknown as Prisma.InputJsonValue,
        },
      });

      const delivery = await transaction.socialDelivery.findFirst({
        where: {
          id: input.input.data.delivery_id,
          tenantId: input.tenantId,
          provider: input.provider,
        },
      });
      if (!delivery) {
        return this.failInbox(
          transaction,
          inbox.id,
          'social_delivery_not_found'
        );
      }

      const nextState = this.deliveryState(input.input.event_type);
      if (!this.transitionAllowed(delivery.state, nextState)) {
        return this.failInbox(
          transaction,
          inbox.id,
          `social_delivery_transition_invalid:${delivery.state.toLowerCase()}:${nextState.toLowerCase()}`
        );
      }

      const terminal = ['PUBLISHED', 'FAILED', 'CANCELLED'].includes(nextState);
      const updated = await transaction.socialDelivery.update({
        where: { id: delivery.id },
        data: {
          state: nextState,
          providerPostId:
            input.input.data.provider_post_id || delivery.providerPostId,
          errorCode:
            nextState === 'FAILED'
              ? input.input.data.error_code || 'provider_failure'
              : null,
          reconciledAt: new Date(),
          completedAt: terminal ? new Date() : delivery.completedAt,
        },
      });

      const deliveries = await transaction.socialDelivery.findMany({
        where: { commandId: delivery.commandId },
        select: { state: true },
      });
      await transaction.socialPublicationCommand.update({
        where: { id: delivery.commandId },
        data: {
          state: this.commandState(deliveries.map(({ state }) => state)),
        },
      });
      await transaction.socialOutboxEvent.create({
        data: {
          tenantId: input.tenantId,
          eventType: input.input.event_type,
          eventVersion: input.input.event_version,
          occurredAt: new Date(input.input.occurred_at),
          correlationId: input.correlationId,
          causationId: inbox.id,
          idempotencyKey: `social.provider:${input.provider}:${input.input.event_id}`,
          payload: {
            command_id: delivery.commandId,
            delivery_id: delivery.id,
            provider: input.provider,
            provider_post_id: updated.providerPostId,
            state: updated.state.toLowerCase(),
            error_code: updated.errorCode,
          },
          metadata: { source: 'codestra-social-provider-worker' },
        },
      });
      const processed = await transaction.socialProviderInbox.update({
        where: { id: inbox.id },
        data: { state: 'PROCESSED', processedAt: new Date() },
      });
      return { inbox: processed, delivery: updated, errorCode: null };
    });
  }

  private async failInbox(
    transaction: Prisma.TransactionClient,
    inboxId: string,
    errorCode: string
  ) {
    const inbox = await transaction.socialProviderInbox.update({
      where: { id: inboxId },
      data: { state: 'FAILED', processedAt: new Date(), errorCode },
    });
    return { inbox, delivery: null as null, errorCode };
  }

  private deliveryState(eventType: string): SocialDeliveryState {
    const states: Record<string, SocialDeliveryState> = {
      'social.provider.accepted': 'PROVIDER_ACCEPTED',
      'social.post.published': 'PUBLISHED',
      'social.post.failed': 'FAILED',
      'social.post.cancelled': 'CANCELLED',
    };
    return states[eventType];
  }

  private transitionAllowed(
    current: SocialDeliveryState,
    next: SocialDeliveryState
  ) {
    if (current === next) return true;
    const transitions: Partial<
      Record<SocialDeliveryState, SocialDeliveryState[]>
    > = {
      PENDING: ['PROVIDER_ACCEPTED', 'PUBLISHED', 'FAILED', 'CANCELLED'],
      PUBLISHING: ['PROVIDER_ACCEPTED', 'PUBLISHED', 'FAILED', 'CANCELLED'],
      RETRY_WAIT: ['PROVIDER_ACCEPTED', 'PUBLISHED', 'FAILED', 'CANCELLED'],
      PROVIDER_ACCEPTED: ['PUBLISHED', 'FAILED', 'CANCELLED'],
    };
    return transitions[current]?.includes(next) === true;
  }

  private commandState(states: SocialDeliveryState[]): SocialCommandState {
    if (states.every((state) => state === 'PUBLISHED')) return 'COMPLETED';
    if (states.every((state) => state === 'CANCELLED')) return 'CANCELLED';
    if (states.some((state) => state === 'BLOCKED')) return 'BLOCKED';
    if (
      states.some((state) =>
        ['PENDING', 'PUBLISHING', 'RETRY_WAIT', 'PROVIDER_ACCEPTED'].includes(
          state
        )
      )
    ) {
      return 'IN_PROGRESS';
    }
    if (states.some((state) => ['FAILED', 'DEAD_LETTERED'].includes(state))) {
      return 'FAILED';
    }
    return 'IN_PROGRESS';
  }
}
