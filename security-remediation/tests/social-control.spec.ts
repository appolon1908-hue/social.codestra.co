import { SocialControlService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-control.service';
import { ServiceAuthContext } from '@gitroom/nestjs-libraries/security/service-auth/service-auth.types';

describe('Codestra social publishing control plane', () => {
  const auth: ServiceAuthContext = {
    subject: 'middleware-service',
    clientId: 'middleware-api',
    tenantId: 'tenant-a',
    scopes: ['social.commands.write'],
    correlationId: '6d62c2fd-839c-4262-9395-47457f5def2c',
    claims: {
      sub: 'middleware-service',
      iss: 'https://auth.codestra.co/realms/codestra',
      aud: 'codestra-social',
      exp: Math.floor(Date.now() / 1000) + 300,
      tenant_id: 'tenant-a',
    },
  };

  beforeEach(() => {
    process.env.SOCIAL_PUBLISHING_ENABLED = 'false';
    process.env.ENABLE_EXTERNAL_DELIVERY = 'false';
    process.env.PUBLISHING_KILL_SWITCH = 'true';
  });

  it('persists a blocked command when external delivery is disabled', async () => {
    const repository = repositoryMock();
    const service = new SocialControlService(repository as never);

    const result = await service.acceptPublication(
      auth,
      'social-command-key-0001',
      command()
    );

    expect(repository.createCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        correlationId: auth.correlationId,
        publishingEnabled: false,
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        state: 'blocked',
        idempotency_replayed: false,
        publishing_enabled: false,
      })
    );
  });

  it('returns the original command for an identical idempotent replay', async () => {
    const repository = repositoryMock();
    const service = new SocialControlService(repository as never);
    await service.acceptPublication(auth, 'social-command-key-0002', command());
    const createInput = repository.createCommand.mock.calls[0][0];
    repository.findCommandByIdempotency.mockResolvedValueOnce(
      persisted(createInput.payloadHash)
    );

    const replay = await service.acceptPublication(
      auth,
      'social-command-key-0002',
      command()
    );

    expect(replay.idempotency_replayed).toBe(true);
    expect(repository.createCommand).toHaveBeenCalledTimes(1);
  });

  it('rejects an idempotency key reused with a conflicting payload', async () => {
    const repository = repositoryMock();
    const service = new SocialControlService(repository as never);
    await service.acceptPublication(auth, 'social-command-key-0003', command());
    const originalHash = repository.createCommand.mock.calls[0][0].payloadHash;
    repository.findCommandByIdempotency.mockResolvedValueOnce(
      persisted(originalHash)
    );

    await expect(
      service.acceptPublication(auth, 'social-command-key-0003', {
        ...command(),
        post: { ...command().post, content: 'different payload' },
      })
    ).rejects.toThrow('idempotency_payload_conflict');
  });

  it('rejects a target whose provider does not match the tenant account', async () => {
    const repository = repositoryMock();
    repository.validateTargets.mockResolvedValueOnce(
      new Map([
        ['account-1', { id: 'account-1', providerIdentifier: 'instagram' }],
      ])
    );
    const service = new SocialControlService(repository as never);

    await expect(
      service.acceptPublication(auth, 'social-command-key-0004', command())
    ).rejects.toThrow('social_provider_mismatch:account-1');
    expect(repository.createCommand).not.toHaveBeenCalled();
  });

  function command() {
    return {
      command_version: '1.0',
      requested_by: 'user-example',
      post: {
        content: 'Codestra Social test publication',
        media_ids: [] as string[],
        metadata: { campaign: 'test' },
      },
      targets: [
        {
          account_id: 'account-1',
          provider: 'linkedin',
          settings: {},
        },
      ],
    };
  }

  function persisted(payloadHash: string) {
    return {
      id: 'command-1',
      tenantId: 'tenant-a',
      commandVersion: '1.0',
      requestedBy: 'user-example',
      correlationId: auth.correlationId,
      idempotencyKey: 'social-command-key',
      payloadHash,
      content: 'Codestra Social test publication',
      mediaIds: [] as string[],
      metadata: {},
      scheduleAt: null as Date | null,
      state: 'BLOCKED',
      publishingEnabledAtAcceptance: false,
      errorCode: null as string | null,
      createdAt: new Date('2026-08-27T18:00:00Z'),
      updatedAt: new Date('2026-08-27T18:00:00Z'),
      deliveries: [delivery()],
    };
  }

  function delivery() {
    return {
      id: 'delivery-1',
      commandId: 'command-1',
      tenantId: 'tenant-a',
      accountId: 'account-1',
      provider: 'linkedin',
      settings: {},
      state: 'BLOCKED',
      attempt: 0,
      providerPostId: null as string | null,
      errorCode: null as string | null,
      nextAttemptAt: null as Date | null,
      startedAt: null as Date | null,
      completedAt: null as Date | null,
      reconciledAt: null as Date | null,
      createdAt: new Date('2026-08-27T18:00:00Z'),
      updatedAt: new Date('2026-08-27T18:00:00Z'),
    };
  }

  function repositoryMock() {
    return {
      findCommandByIdempotency: jest.fn().mockResolvedValue(null),
      validateTargets: jest
        .fn()
        .mockResolvedValue(
          new Map([
            ['account-1', { id: 'account-1', providerIdentifier: 'linkedin' }],
          ])
        ),
      createCommand: jest.fn().mockImplementation(async (input) => ({
        ...persisted(input.payloadHash),
        idempotencyKey: input.idempotencyKey,
      })),
      findCommand: jest.fn(),
      findDelivery: jest.fn(),
    };
  }
});
