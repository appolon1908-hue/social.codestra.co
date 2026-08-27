import crypto from 'node:crypto';
import { CodestraSocial } from '../../apps/sdk/src';
import {
  signCodestraWebhook,
  verifyCodestraWebhook,
} from '../../apps/webhook-sdk/src';
import { OdooAdapter } from '../../apps/connector-kit/src';

describe('Codestra SDK platform', () => {
  it('adds tenant, correlation, bearer and idempotency context', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 202,
        json: async () => ({
          command_id: 'c',
          state: 'accepted',
          replayed: false,
        }),
        headers: new Headers(),
      });
    const client = new CodestraSocial({
      accessToken: 'token',
      tenantId: 'tenant',
      fetch: fetcher,
    });
    await client.campaigns.create(
      { name: 'Launch' },
      {
        idempotencyKey: 'idempotency-key-1234',
        correlationId: '00000000-0000-4000-8000-000000000001',
      }
    );
    const request = fetcher.mock.calls[0][1];
    expect(request.headers).toMatchObject({
      Authorization: 'Bearer token',
      'X-Tenant-ID': 'tenant',
      'Idempotency-Key': 'idempotency-key-1234',
    });
  });

  it('verifies rotated webhook secrets and rejects replay', async () => {
    const event = {
      specversion: '1.0',
      id: crypto.randomUUID(),
      source: 'codestra.social',
      type: 'social.publication.completed.v2',
      time: new Date().toISOString(),
      tenantid: 't',
      correlationid: crypto.randomUUID(),
      datacontenttype: 'application/json',
      data: {},
    } as const;
    const rawBody = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const headers = signCodestraWebhook(rawBody, 'current-secret', timestamp);
    const claim = jest
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await expect(
      verifyCodestraWebhook({
        rawBody,
        signature: headers['x-codestra-signature'],
        timestamp: headers['x-codestra-timestamp'],
        secrets: ['next-secret', 'current-secret'],
        replayStore: { claim },
      })
    ).resolves.toMatchObject({ id: event.id });
    await expect(
      verifyCodestraWebhook({
        rawBody,
        signature: headers['x-codestra-signature'],
        timestamp: headers['x-codestra-timestamp'],
        secrets: ['current-secret'],
        replayStore: { claim },
      })
    ).rejects.toThrow('event_replayed');
  });

  it('blocks enterprise connector writes when capability is disabled', async () => {
    const fetcher = jest.fn();
    const adapter = new OdooAdapter(
      'https://middleware.codestra.internal',
      fetcher
    );
    await expect(
      adapter.execute(
        {
          tenantId: 't',
          correlationId: crypto.randomUUID(),
          idempotencyKey: 'idempotency-key-1234',
          liveWritesEnabled: false,
        },
        { type: 'contact.sync', payload: {} }
      )
    ).resolves.toMatchObject({
      accepted: false,
      metadata: { blocked_by: 'live_write_kill_switch' },
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
