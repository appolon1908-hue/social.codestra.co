import { SocialBrandService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-brand.service';

describe('Codestra governed brand intelligence', () => {
  const auth: any = {
    tenantId: 'tenant-a',
    correlationId: 'f5b5a7e0-49d2-4d10-a554-e95991286fa0',
  };
  beforeEach(() => {
    process.env.SOCIAL_AI_GENERATION_ENABLED = 'false';
  });

  it('blocks AI execution by default and never auto-publishes', async () => {
    const repository = mockRepository();
    const service = new SocialBrandService(repository as never);
    const result = await service.requestGeneration(
      auth,
      'brand-generation-0001',
      request()
    );
    expect(result).toEqual(
      expect.objectContaining({ state: 'blocked', automatic_publish: false })
    );
  });

  it('scores prohibited brand claims when generation is enabled', async () => {
    process.env.SOCIAL_AI_GENERATION_ENABLED = 'true';
    const repository = mockRepository();
    const service = new SocialBrandService(repository as never);
    const result = await service.requestGeneration(
      auth,
      'brand-generation-0002',
      {
        ...request(),
        prompt: 'Promise guaranteed results',
      }
    );
    expect(result).toEqual(
      expect.objectContaining({ state: 'review_required', risk_score: 50 })
    );
  });

  function request() {
    return {
      requested_by: 'user-1',
      brand_revision_id: 'revision-1',
      objective: 'Awareness',
      prompt: 'Professional announcement',
      sources: [] as Record<string, unknown>[],
      model_policy: { training_allowed: false },
    };
  }
  function mockRepository() {
    return {
      generationByIdempotency: jest.fn().mockResolvedValue(null),
      revision: jest.fn().mockResolvedValue({
        id: 'revision-1',
        prohibitedTopics: [],
        prohibitedClaims: ['guaranteed'],
      }),
      createGeneration: jest.fn().mockImplementation(async (input) => ({
        id: 'generation-1',
        state: input.state,
        riskScore: input.riskScore,
        riskFindings: input.findings,
      })),
    };
  }
});
