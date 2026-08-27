import { SocialOnboardingService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-onboarding.service';
import { ServiceAuthContext } from '@gitroom/nestjs-libraries/security/service-auth/service-auth.types';

describe('Codestra Social tenant onboarding', () => {
  const auth: ServiceAuthContext = {
    subject: 'middleware-service',
    clientId: 'middleware-api',
    tenantId: 'tenant-a',
    scopes: ['social.onboarding.write'],
    correlationId: '76b3e3f6-5392-420f-a7de-d19f315a3315',
    claims: {
      sub: 'middleware-service',
      iss: 'https://auth.codestra.co/realms/codestra',
      aud: 'codestra-social',
      exp: Math.floor(Date.now() / 1000) + 300,
      tenant_id: 'tenant-a',
    },
  };

  it('advances only the next state and records tenant-bound evidence', async () => {
    const repository = repositoryMock();
    const service = new SocialOnboardingService(repository as never);
    const result = await service.advance(auth, 'onboarding-key-0001', {
      to_state: 'identity_verified',
      requested_by: 'user-1',
      evidence: { keycloak_subject: 'user-1' },
    });

    expect(repository.advance).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        fromState: 'CREATED',
        toState: 'IDENTITY_VERIFIED',
        expectedVersion: 0,
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        state: 'identity_verified',
        next_state: 'workspace_configured',
        activation_automatic: false,
      })
    );
  });

  it('rejects skipped onboarding states', async () => {
    const service = new SocialOnboardingService(repositoryMock() as never);
    await expect(
      service.advance(auth, 'onboarding-key-0002', {
        to_state: 'brand_ready',
        requested_by: 'user-1',
        evidence: { brand_profile: 'brand-1' },
      })
    ).rejects.toThrow('invalid_onboarding_transition:created:brand_ready');
  });

  it('rejects a conflicting idempotent replay', async () => {
    const repository = repositoryMock();
    repository.findTransition.mockResolvedValueOnce({
      payloadHash: 'different',
      onboarding: onboarding('CREATED', 0),
    });
    const service = new SocialOnboardingService(repository as never);
    await expect(
      service.advance(auth, 'onboarding-key-0003', {
        to_state: 'identity_verified',
        requested_by: 'user-1',
        evidence: { keycloak_subject: 'user-1' },
      })
    ).rejects.toThrow('idempotency_payload_conflict');
  });

  function onboarding(state: string, version: number) {
    return {
      id: 'onboarding-1',
      tenantId: 'tenant-a',
      state,
      readiness: {},
      version,
      createdAt: new Date('2026-08-27T19:00:00Z'),
      updatedAt: new Date('2026-08-27T19:00:00Z'),
      transitions: [] as unknown[],
    };
  }

  function repositoryMock() {
    return {
      getOrCreate: jest.fn().mockResolvedValue(onboarding('CREATED', 0)),
      findTransition: jest.fn().mockResolvedValue(null),
      advance: jest.fn().mockImplementation(async (input) => ({
        onboarding: {
          ...onboarding(input.toState, input.expectedVersion + 1),
          readiness: input.evidence,
        },
        transition: { id: 'transition-1' },
      })),
    };
  }
});
