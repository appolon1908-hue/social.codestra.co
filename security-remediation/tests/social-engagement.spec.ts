import { SocialEngagementService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-engagement.service';
describe('Codestra engagement inbox', () => {
  it('rejects a provider event already bound to another tenant', async () => {
    const prisma: any = {
      socialEngagementItem: {
        findUnique: jest.fn().mockResolvedValue({ tenantId: 'other' }),
      },
    };
    const service = new SocialEngagementService(prisma);
    await expect(
      service.ingest({ tenantId: 't' } as any, {
        provider_event_id: 'e',
        provider: 'x',
        account_id: 'a',
        kind: 'comment',
        external_author: {},
        content: 'x',
        occurred_at: new Date().toISOString(),
        priority: 3,
      })
    ).rejects.toThrow('provider_event_tenant_conflict');
  });
  it('hides cross-tenant assignments', async () => {
    const prisma: any = {
      socialEngagementItem: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new SocialEngagementService(prisma);
    await expect(
      service.assign({ tenantId: 't' } as any, 'missing', {
        actor: 'u',
        assigned_to: 'agent',
      })
    ).rejects.toThrow('engagement_not_found');
  });
});
