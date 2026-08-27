import crypto from 'node:crypto';
import { SocialProviderWebhookVerifier } from '@gitroom/nestjs-libraries/security/social-provider-webhook.verifier';
import { SocialProviderEventsService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-provider-events.service';
import { SocialProviderEventDto } from '@gitroom/nestjs-libraries/dtos/social-control/social-provider-event.dto';

describe('Codestra Social provider callback boundary', () => {
  const tenantId = '8cfc962c-51cb-4d31-a308-ab217dd0e0f5';
  const correlationId = '997053b7-2f49-493b-859c-ae9eeac30576';
  const secret = 'provider-worker-secret-with-32-bytes-minimum';
  const now = Date.UTC(2026, 7, 27, 19, 0, 0);
  const timestamp = String(Math.floor(now / 1000));

  beforeEach(() => {
    process.env.SOCIAL_PROVIDER_CALLBACKS_ENABLED = 'true';
    process.env.SOCIAL_PROVIDER_WEBHOOK_TOLERANCE_SECONDS = '300';
    process.env.SOCIAL_PROVIDER_WEBHOOK_SECRETS_JSON = JSON.stringify({
      [`${tenantId}:linkedin`]: secret,
    });
  });

  it('accepts an exact raw-body HMAC for the tenant and provider', () => {
    const verifier = new SocialProviderWebhookVerifier();
    const rawBody = Buffer.from(JSON.stringify(event()));

    expect(() =>
      verifier.verify({
        tenantId,
        provider: 'linkedin',
        timestamp,
        signature: signature(rawBody),
        rawBody,
        now,
      })
    ).not.toThrow();
  });

  it('rejects tampered bodies, stale timestamps, and disabled callbacks', () => {
    const verifier = new SocialProviderWebhookVerifier();
    const rawBody = Buffer.from(JSON.stringify(event()));

    expect(() =>
      verifier.verify({
        tenantId,
        provider: 'linkedin',
        timestamp,
        signature: signature(rawBody),
        rawBody: Buffer.from(`${rawBody.toString()} `),
        now,
      })
    ).toThrow('provider_callback_signature_invalid');

    expect(() =>
      verifier.verify({
        tenantId,
        provider: 'linkedin',
        timestamp,
        signature: signature(rawBody),
        rawBody,
        now: now + 301_000,
      })
    ).toThrow('provider_callback_timestamp_invalid');

    process.env.SOCIAL_PROVIDER_CALLBACKS_ENABLED = 'false';
    expect(() =>
      verifier.verify({
        tenantId,
        provider: 'linkedin',
        timestamp,
        signature: signature(rawBody),
        rawBody,
        now,
      })
    ).toThrow('provider_callbacks_disabled');
  });

  it('replays identical inbox events and rejects semantic conflicts', async () => {
    const rawBody = Buffer.from(JSON.stringify(event()));
    const payloadHash = crypto
      .createHash('sha256')
      .update(rawBody)
      .digest('hex');
    const repository = {
      findInbox: jest.fn().mockResolvedValue({
        id: 'inbox-1',
        state: 'PROCESSED',
        payloadHash,
        errorCode: null,
      }),
      process: jest.fn(),
    };
    const verifier = { verify: jest.fn() };
    const service = new SocialProviderEventsService(
      repository as never,
      verifier as never
    );

    await expect(
      service.receive({
        tenantId,
        provider: 'linkedin',
        correlationId,
        timestamp,
        signature: signature(rawBody),
        rawBody,
        body: event(),
      })
    ).resolves.toEqual({
      inbox_id: 'inbox-1',
      state: 'processed',
      idempotency_replayed: true,
    });

    await expect(
      service.receive({
        tenantId,
        provider: 'linkedin',
        correlationId,
        timestamp,
        signature: signature(rawBody),
        rawBody: Buffer.from(`${rawBody.toString()} `),
        body: event(),
      })
    ).rejects.toThrow('provider_event_payload_conflict');
    expect(repository.process).not.toHaveBeenCalled();
  });

  function event(): SocialProviderEventDto {
    return {
      event_id: 'linkedin-event-0001',
      event_type: 'social.post.published',
      event_version: '1.0',
      occurred_at: '2026-08-27T19:00:00.000Z',
      data: {
        delivery_id: '58ea2714-5ea7-4f85-b75a-774096f1bfe6',
        provider_post_id: 'linkedin-post-1',
        provider_payload: { status: 'published' },
      },
    };
  }

  function signature(rawBody: Buffer) {
    return `v1=${crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest('hex')}`;
  }
});
