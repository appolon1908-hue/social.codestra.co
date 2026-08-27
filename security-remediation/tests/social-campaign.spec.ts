import { SocialCampaignService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-campaign.service';
describe('Codestra campaign command center', () => {
  it('rejects a brand owned by another tenant', async () => {
    const prisma: any = {
      socialBrandProfile: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new SocialCampaignService(prisma);
    await expect(
      service.create({ tenantId: 'tenant-a' } as any, {
        name: 'Launch',
        objective: 'Awareness',
        owner_id: 'owner',
        timezone: 'UTC',
        starts_at: '2026-09-01T00:00:00Z',
        ends_at: '2026-09-30T00:00:00Z',
        brand_id: 'tenant-b-brand',
        budget: {},
      })
    ).rejects.toThrow('brand_not_found');
  });
  it('rejects invalid and reversed calendar windows', () => {
    const service = new SocialCampaignService({} as any);
    expect(() =>
      service.calendar({ tenantId: 't' } as any, 'bad', '2026-09-30')
    ).toThrow('calendar_date_range_invalid');
    expect(() =>
      service.calendar({ tenantId: 't' } as any, '2026-10-01', '2026-09-30')
    ).toThrow('calendar_date_range_invalid');
  });
  it('blocks an item outside the corporate campaign window', async () => {
    const prisma: any = {
      socialCampaign: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'c',
          startsAt: new Date('2026-09-01'),
          endsAt: new Date('2026-09-30'),
        }),
      },
    };
    const service = new SocialCampaignService(prisma);
    await expect(
      service.addItem({ tenantId: 't' } as any, 'c', {
        content_revision_id: 'r',
        scheduled_at: '2026-10-01T00:00:00Z',
        timezone: 'UTC',
        targets: [],
      })
    ).rejects.toThrow('campaign_item_outside_window');
  });
  it('requires approved matching revision before marking an item approved', async () => {
    const prisma: any = {
      socialCampaign: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'c',
          startsAt: new Date('2026-09-01'),
          endsAt: new Date('2026-09-30'),
        }),
      },
      socialApprovalRequest: { findFirst: jest.fn().mockResolvedValue(null) },
      socialCampaignItem: {
        create: jest.fn().mockImplementation((x: any) => x.data),
      },
    };
    const service = new SocialCampaignService(prisma);
    const out: any = await service.addItem({ tenantId: 't' } as any, 'c', {
      content_revision_id: 'r',
      approval_request_id: 'a',
      scheduled_at: '2026-09-10T00:00:00Z',
      timezone: 'UTC',
      targets: [],
    });
    expect(out.state).toBe('APPROVAL_REQUIRED');
    expect(prisma.socialApprovalRequest.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        resourceId: 'r',
        revisionId: 'r',
        tenantId: 't',
      }),
    });
  });
});
