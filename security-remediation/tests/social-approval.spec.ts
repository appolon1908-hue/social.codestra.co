import { SocialApprovalService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-approval.service';
describe('Codestra approvals', () => {
  it('enforces separation of duties', async () => {
    const prisma: any = {
      socialApprovalRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'a',
          tenantId: 't',
          state: 'PENDING',
          submittedBy: 'owner',
          currentStage: 0,
          policy: { stages: [{}] },
        }),
      },
      $transaction: async (fn: any) => fn(prisma),
    };
    const service = new SocialApprovalService(prisma);
    await expect(
      service.decide({ tenantId: 't' } as any, 'a', {
        actor: 'owner',
        decision: 'approve',
      })
    ).rejects.toThrow('approval_separation_of_duties');
  });
  it('stores only a hash of an external token', async () => {
    const prisma: any = {
      socialApprovalRequest: {
        findFirst: jest.fn().mockResolvedValue({ id: 'a' }),
      },
      socialExternalReviewToken: { create: jest.fn() },
    };
    const service = new SocialApprovalService(prisma);
    const out = await service.createReviewToken({ tenantId: 't' } as any, 'a', {
      created_by: 'owner',
      expires_in_minutes: 60,
      max_uses: 1,
    });
    expect(out.review_url).toContain('https://social.codestra.co/review/');
    expect(
      prisma.socialExternalReviewToken.create.mock.calls[0][0].data.tokenHash
    ).not.toBe(out.review_token);
  });
  it('fails closed when another reviewer wins the same stage', async () => {
    const prisma: any = {
      socialApprovalRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'a',
          tenantId: 't',
          state: 'PENDING',
          submittedBy: 'owner',
          currentStage: 0,
          policy: { stages: [{}] },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: async (fn: any) => fn(prisma),
    };
    const service = new SocialApprovalService(prisma);
    await expect(
      service.decide({ tenantId: 't' } as any, 'a', {
        actor: 'reviewer',
        decision: 'approve',
      })
    ).rejects.toThrow('approval_concurrent_decision');
    expect(prisma.socialApprovalRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ state: 'PENDING', currentStage: 0 }),
      })
    );
  });
});
