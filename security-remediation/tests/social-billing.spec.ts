import { SocialBillingService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-billing.service';
import { ServiceAuthContext } from '@gitroom/nestjs-libraries/security/service-auth/service-auth.types';

describe('Codestra Social SaaS billing events', () => {
  const auth: ServiceAuthContext = {
    subject: 'middleware-service',
    clientId: 'middleware-api',
    tenantId: 'tenant-a',
    scopes: ['social.billing.events.write'],
    correlationId: '27ae4802-12be-4cb1-a3a4-cf739f7ada99',
    claims: {
      sub: 'middleware-service',
      iss: 'https://auth.codestra.co/realms/codestra',
      aud: 'codestra-social',
      exp: Math.floor(Date.now() / 1000) + 300,
      tenant_id: 'tenant-a',
    },
  };

  it('applies a normalized monthly subscription without changing publishing', async () => {
    const repository = repositoryMock();
    const service = new SocialBillingService(repository as never);
    const result = await service.accept(
      auth,
      'billing-event-key-0001',
      event()
    );
    expect(repository.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        tier: 'PRO',
        channels: 20,
        state: 'ACTIVE',
        period: 'MONTHLY',
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        state: 'active',
        plan_code: 'professional',
        publishing_changed: false,
      })
    );
  });

  it('rejects stale provider events', async () => {
    const repository = repositoryMock();
    repository.subscription.mockResolvedValueOnce({
      providerUpdatedAt: new Date('2026-08-28T00:00:00Z'),
    });
    const service = new SocialBillingService(repository as never);
    await expect(
      service.accept(auth, 'billing-event-key-0002', event())
    ).rejects.toThrow('stale_billing_event');
  });

  it('rejects conflicting idempotency replays', async () => {
    const repository = repositoryMock();
    repository.findEvent.mockResolvedValueOnce({
      id: 'event-1',
      payloadHash: 'different',
      state: 'APPLIED',
    });
    const service = new SocialBillingService(repository as never);
    await expect(
      service.accept(auth, 'billing-event-key-0003', event())
    ).rejects.toThrow('idempotency_payload_conflict');
  });

  function event() {
    return {
      event_version: '2.0',
      provider_event_id: 'evt_codestra_1',
      event_type: 'subscription.updated',
      occurred_at: '2026-08-27T20:00:00Z',
      customer_id: 'cus_codestra_1',
      subscription_id: 'sub_codestra_1',
      plan_code: 'professional' as const,
      catalog_version: '2026-08-v1',
      period: 'monthly' as const,
      seat_quantity: 5,
      status: 'active' as const,
      current_period_start: '2026-08-01T00:00:00Z',
      current_period_end: '2026-09-01T00:00:00Z',
      cancel_at_period_end: false,
      entitlements: { connected_accounts: 20, users: 5 },
    };
  }

  function repositoryMock() {
    return {
      findEvent: jest.fn().mockResolvedValue(null),
      subscription: jest.fn().mockResolvedValue(null),
      apply: jest.fn().mockResolvedValue({
        inbox: { id: 'event-1' },
        subscription: {
          id: 'subscription-1',
          state: 'ACTIVE',
          planCode: 'professional',
        },
      }),
    };
  }
});
