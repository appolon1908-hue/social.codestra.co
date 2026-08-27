import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { ServiceAuthContext } from '@gitroom/nestjs-libraries/security/service-auth/service-auth.types';
import {
  SocialEngagementAssignDto,
  SocialEngagementEscalateDto,
  SocialEngagementIngestDto,
} from '@gitroom/nestjs-libraries/dtos/social-control/social-engagement.dto';
@Injectable()
export class SocialEngagementService {
  constructor(private readonly prisma: PrismaService) {}
  async ingest(auth: ServiceAuthContext, input: SocialEngagementIngestDto) {
    const replay = await this.prisma.socialEngagementItem.findUnique({
      where: { providerEventId: input.provider_event_id },
    });
    if (replay) {
      if (replay.tenantId !== auth.tenantId)
        throw new ConflictException('provider_event_tenant_conflict');
      return { ...replay, replayed: true };
    }
    const account = await this.prisma.integration.findFirst({
      where: {
        id: input.account_id,
        organizationId: auth.tenantId,
        deletedAt: null,
      },
    });
    if (!account) throw new NotFoundException('social_account_not_found');
    const item = await this.prisma.socialEngagementItem.create({
      data: {
        tenantId: auth.tenantId,
        providerEventId: input.provider_event_id,
        provider: input.provider,
        accountId: input.account_id,
        kind: input.kind,
        externalAuthor: input.external_author as Prisma.InputJsonObject,
        content: input.content,
        occurredAt: new Date(input.occurred_at),
        sentiment: input.sentiment,
        priority: input.priority,
        slaDueAt: input.sla_due_at ? new Date(input.sla_due_at) : null,
        correlationId: auth.correlationId,
      },
    });
    return { ...item, replayed: false };
  }
  list(auth: ServiceAuthContext) {
    return this.prisma.socialEngagementItem.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: [{ priority: 'asc' }, { occurredAt: 'asc' }],
    });
  }
  async assign(
    auth: ServiceAuthContext,
    id: string,
    input: SocialEngagementAssignDto
  ) {
    const item = await this.prisma.socialEngagementItem.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!item) throw new NotFoundException('engagement_not_found');
    return this.prisma.$transaction(async (tx) => {
      await tx.socialEngagementAction.create({
        data: {
          tenantId: auth.tenantId,
          engagementId: id,
          action: 'assigned',
          actor: input.actor,
          metadata: { assigned_to: input.assigned_to },
        },
      });
      return tx.socialEngagementItem.update({
        where: { id },
        data: { assignedTo: input.assigned_to, state: 'ASSIGNED' },
      });
    });
  }
  async escalate(
    auth: ServiceAuthContext,
    id: string,
    input: SocialEngagementEscalateDto
  ) {
    const item = await this.prisma.socialEngagementItem.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!item) throw new NotFoundException('engagement_not_found');
    return this.prisma.$transaction(async (tx) => {
      await tx.socialEngagementAction.create({
        data: {
          tenantId: auth.tenantId,
          engagementId: id,
          action: 'odoo_escalation_requested',
          actor: input.actor,
          metadata: { reason: input.reason },
        },
      });
      await tx.socialOutboxEvent.create({
        data: {
          tenantId: auth.tenantId,
          eventType: 'social.engagement.escalation.requested',
          eventVersion: '2.0',
          occurredAt: new Date(),
          correlationId: auth.correlationId,
          causationId: id,
          idempotencyKey: `social.engagement.escalation:${id}`,
          payload: { engagement_id: id, reason: input.reason },
          metadata: { destination: 'middleware' },
        },
      });
      return tx.socialEngagementItem.update({
        where: { id },
        data: { state: 'ESCALATED' },
      });
    });
  }
}
