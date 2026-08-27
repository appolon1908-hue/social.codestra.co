import { SocialCampaignService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-campaign.service';
describe('Codestra campaign command center', () => {
  it('blocks an item outside the corporate campaign window', async () => {
    const prisma: any = {
      socialCampaign: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
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
        findFirst: jest
          .fn()
          .mockResolvedValue({
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
  });
});
