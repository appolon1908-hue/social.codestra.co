import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SocialCommandState,
  SocialDeliveryState,
} from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { SocialPublicationCommandDto } from '@gitroom/nestjs-libraries/dtos/social-control/social-publication-command.dto';

export type CreateSocialCommand = {
  tenantId: string;
  correlationId: string;
  idempotencyKey: string;
  payloadHash: string;
  publishingEnabled: boolean;
  input: SocialPublicationCommandDto;
};

@Injectable()
export class SocialControlRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCommandByIdempotency(tenantId: string, idempotencyKey: string) {
    return this.prisma.socialPublicationCommand.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      include: { deliveries: { orderBy: { createdAt: 'asc' } } },
    });
  }

  findCommand(tenantId: string, commandId: string) {
    return this.prisma.socialPublicationCommand.findFirst({
      where: { id: commandId, tenantId },
      include: { deliveries: { orderBy: { createdAt: 'asc' } } },
    });
  }

  findDelivery(tenantId: string, deliveryId: string) {
    return this.prisma.socialDelivery.findFirst({
      where: { id: deliveryId, tenantId },
    });
  }

  async validateTargets(
    tenantId: string,
    targets: SocialPublicationCommandDto['targets']
  ) {
    const accounts = await this.prisma.integration.findMany({
      where: {
        id: { in: targets.map((target) => target.account_id) },
        organizationId: tenantId,
        disabled: false,
        deletedAt: null,
      },
      select: { id: true, providerIdentifier: true },
    });
    return new Map(accounts.map((account) => [account.id, account]));
  }

  async createCommand(command: CreateSocialCommand) {
    const now = new Date();
    const commandState: SocialCommandState = command.publishingEnabled
      ? 'QUEUED'
      : 'BLOCKED';
    const deliveryState: SocialDeliveryState = command.publishingEnabled
      ? 'PENDING'
      : 'BLOCKED';
    return this.prisma.$transaction(async (transaction) => {
      const created = await transaction.socialPublicationCommand.create({
        data: {
          tenantId: command.tenantId,
          commandVersion: command.input.command_version,
          requestedBy: command.input.requested_by,
          correlationId: command.correlationId,
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
          content: command.input.post.content,
          mediaIds: command.input.post.media_ids || [],
          metadata: (command.input.post.metadata ||
            {}) as Prisma.InputJsonValue,
          scheduleAt: command.input.schedule_at
            ? new Date(command.input.schedule_at)
            : null,
          state: commandState,
          publishingEnabledAtAcceptance: command.publishingEnabled,
          deliveries: {
            create: command.input.targets.map((target) => ({
              tenantId: command.tenantId,
              accountId: target.account_id,
              provider: target.provider,
              settings: target.settings as Prisma.InputJsonValue,
              state: deliveryState,
            })),
          },
        },
        include: { deliveries: { orderBy: { createdAt: 'asc' } } },
      });
      await transaction.socialOutboxEvent.create({
        data: {
          tenantId: command.tenantId,
          eventType: 'social.post.created',
          eventVersion: '1.0',
          occurredAt: now,
          correlationId: command.correlationId,
          causationId: created.id,
          idempotencyKey: `social.post.created:${created.id}`,
          payload: {
            command_id: created.id,
            state: created.state.toLowerCase(),
            delivery_ids: created.deliveries.map((delivery) => delivery.id),
            publishing_enabled: command.publishingEnabled,
          },
          metadata: { source: 'codestra-social' },
        },
      });
      return created;
    });
  }
}
