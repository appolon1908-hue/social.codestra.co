import { SocialMiddlewareOutboxDispatcher } from '@gitroom/nestjs-libraries/integrations/codestra/social-middleware-outbox.dispatcher';

describe('Codestra Social Middleware outbox dispatcher', () => {
  beforeEach(() => {
    process.env.MIDDLEWARE_OUTBOX_ENABLED = 'true';
    process.env.MIDDLEWARE_OUTBOX_MAX_ATTEMPTS = '8';
  });

  it('does not claim events while the integration is disabled', async () => {
    process.env.MIDDLEWARE_OUTBOX_ENABLED = 'false';
    const repository = repositoryMock();
    const dispatcher = new SocialMiddlewareOutboxDispatcher(
      repository as never,
      { deliver: jest.fn() } as never
    );

    await expect(dispatcher.dispatch('worker-1')).resolves.toEqual({
      disabled: true,
      processed: 0,
      delivered: 0,
      failed: 0,
    });
    expect(repository.claimDue).not.toHaveBeenCalled();
  });

  it('acknowledges successful events and schedules failures durably', async () => {
    const repository = repositoryMock();
    const first = event('event-1');
    const second = event('event-2');
    repository.claimDue.mockResolvedValue([first, second]);
    const client = {
      deliver: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('middleware_http_503')),
    };
    const dispatcher = new SocialMiddlewareOutboxDispatcher(
      repository as never,
      client as never
    );

    await expect(dispatcher.dispatch('worker-1', 10)).resolves.toEqual({
      disabled: false,
      processed: 2,
      delivered: 1,
      failed: 1,
    });
    expect(repository.markDelivered).toHaveBeenCalledWith(
      'event-1',
      'worker-1'
    );
    expect(repository.recordFailure).toHaveBeenCalledWith(
      second,
      'worker-1',
      'middleware_http_503',
      8
    );
  });

  function repositoryMock() {
    return {
      claimDue: jest.fn().mockResolvedValue([]),
      markDelivered: jest.fn().mockResolvedValue({ count: 1 }),
      recordFailure: jest.fn().mockResolvedValue({ count: 1 }),
    };
  }

  function event(id: string) {
    return {
      id,
      tenantId: '8cfc962c-51cb-4d31-a308-ab217dd0e0f5',
      eventType: 'social.post.published',
      eventVersion: '1.0',
      occurredAt: new Date('2026-08-27T20:00:00.000Z'),
      receivedAt: new Date('2026-08-27T20:00:01.000Z'),
      correlationId: '997053b7-2f49-493b-859c-ae9eeac30576',
      causationId: null as string | null,
      idempotencyKey: `social-event:${id}`,
      payload: {},
      metadata: {},
      state: 'LEASED',
      attempt: 0,
      nextAttemptAt: null as Date | null,
      leaseOwner: 'worker-1',
      leaseExpiresAt: new Date('2026-08-27T20:01:00.000Z'),
      deliveredAt: null as Date | null,
      errorCode: null as string | null,
      createdAt: new Date('2026-08-27T20:00:01.000Z'),
      updatedAt: new Date('2026-08-27T20:00:01.000Z'),
    };
  }
});
