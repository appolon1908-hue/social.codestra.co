import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { ServiceAuthContext } from '@gitroom/nestjs-libraries/security/service-auth/service-auth.types';
import {
  SocialCampaignCreateDto,
  SocialCampaignItemDto,
} from '@gitroom/nestjs-libraries/dtos/social-control/social-campaign.dto';
@Injectable()
export class SocialCampaignService {
  constructor(private readonly prisma: PrismaService) {}
  async create(auth: ServiceAuthContext, input: SocialCampaignCreateDto) {
    const startsAt = new Date(input.starts_at);
    const endsAt = new Date(input.ends_at);
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    )
      throw new BadRequestException('campaign_date_range_invalid');
    this.assertTimezone(input.timezone);
    if (input.brand_id) {
      const brand = await this.prisma.socialBrandProfile.findFirst({
        where: { id: input.brand_id, tenantId: auth.tenantId },
        select: { id: true },
      });
      if (!brand) throw new NotFoundException('brand_not_found');
    }
    return this.prisma.socialCampaign.create({
      data: {
        tenantId: auth.tenantId,
        brandId: input.brand_id,
        name: input.name,
        objective: input.objective,
        ownerId: input.owner_id,
        timezone: input.timezone,
        startsAt,
        endsAt,
        budget: input.budget as Prisma.InputJsonObject,
      },
    });
  }
  calendar(auth: ServiceAuthContext, from: string, to: string) {
    const startsAt = new Date(from);
    const endsAt = new Date(to);
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt < startsAt
    )
      throw new BadRequestException('calendar_date_range_invalid');
    return this.prisma.socialCampaignItem.findMany({
      where: {
        tenantId: auth.tenantId,
        scheduledAt: { gte: startsAt, lte: endsAt },
      },
      include: { campaign: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }
  async addItem(
    auth: ServiceAuthContext,
    id: string,
    input: SocialCampaignItemDto
  ) {
    const campaign = await this.prisma.socialCampaign.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!campaign) throw new NotFoundException('campaign_not_found');
    const when = new Date(input.scheduled_at);
    if (Number.isNaN(when.getTime()))
      throw new BadRequestException('campaign_item_date_invalid');
    this.assertTimezone(input.timezone);
    if (when < campaign.startsAt || when > campaign.endsAt)
      throw new BadRequestException('campaign_item_outside_window');
    let state: 'APPROVAL_REQUIRED' | 'APPROVED' = 'APPROVAL_REQUIRED';
    if (input.approval_request_id) {
      const approval = await this.prisma.socialApprovalRequest.findFirst({
        where: {
          id: input.approval_request_id,
          tenantId: auth.tenantId,
          resourceId: input.content_revision_id,
          revisionId: input.content_revision_id,
          state: 'APPROVED',
        },
      });
      if (approval) state = 'APPROVED';
    }
    return this.prisma.socialCampaignItem.create({
      data: {
        tenantId: auth.tenantId,
        campaignId: id,
        contentRevisionId: input.content_revision_id,
        approvalRequestId: input.approval_request_id,
        scheduledAt: when,
        timezone: input.timezone,
        targets: input.targets as Prisma.InputJsonArray,
        state,
      },
    });
  }
  private assertTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException('timezone_invalid');
    }
  }
}
