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
  it('makes repeated escalation idempotent without another outbox write', async () => {
    const item = { id: 'e', tenantId: 't', state: 'ESCALATED' };
    const prisma: any = {
      socialEngagementItem: { findFirst: jest.fn().mockResolvedValue(item) },
      $transaction: jest.fn(),
    };
    const service = new SocialEngagementService(prisma);
    await expect(
      service.escalate({ tenantId: 't', correlationId: 'c' } as any, 'e', {
        actor: 'u',
        reason: 'support',
      })
    ).resolves.toEqual(expect.objectContaining({ replayed: true }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
