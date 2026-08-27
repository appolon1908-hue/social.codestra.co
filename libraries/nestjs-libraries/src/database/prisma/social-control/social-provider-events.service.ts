import crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SocialProviderEventDto } from '@gitroom/nestjs-libraries/dtos/social-control/social-provider-event.dto';
import { SocialProviderWebhookVerifier } from '@gitroom/nestjs-libraries/security/social-provider-webhook.verifier';
import { SocialProviderEventsRepository } from './social-provider-events.repository';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDER_PATTERN = /^[a-z0-9][a-z0-9_-]{1,49}$/;

@Injectable()
export class SocialProviderEventsService {
  constructor(
    private readonly repository: SocialProviderEventsRepository,
    private readonly verifier: SocialProviderWebhookVerifier
  ) {}

  async receive(input: {
    tenantId: string | undefined;
    provider: string;
    correlationId: string | undefined;
    timestamp: string | undefined;
    signature: string | undefined;
    rawBody: Buffer | undefined;
    body: SocialProviderEventDto;
  }) {
    if (!input.tenantId || !UUID_PATTERN.test(input.tenantId)) {
      throw new BadRequestException('valid_tenant_id_required');
    }
    if (!input.correlationId || !UUID_PATTERN.test(input.correlationId)) {
      throw new BadRequestException('valid_correlation_id_required');
    }
    if (!PROVIDER_PATTERN.test(input.provider)) {
      throw new BadRequestException('valid_provider_required');
    }
    if (!input.rawBody) {
      throw new BadRequestException('raw_callback_body_required');
    }
    this.verifier.verify({
      tenantId: input.tenantId,
      provider: input.provider,
      timestamp: input.timestamp,
      signature: input.signature,
      rawBody: input.rawBody,
    });

    const payloadHash = crypto
      .createHash('sha256')
      .update(input.rawBody)
      .digest('hex');
    const existing = await this.repository.findInbox(
      input.tenantId,
      input.provider,
      input.body.event_id
    );
    if (existing) return this.replay(existing, payloadHash);

    try {
      const result = await this.repository.process({
        tenantId: input.tenantId,
        provider: input.provider,
        correlationId: input.correlationId,
        payloadHash,
        input: input.body,
      });
      if (result.errorCode) {
        throw new UnprocessableEntityException(result.errorCode);
      }
      return this.response(result.inbox, false);
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const raced = await this.repository.findInbox(
        input.tenantId,
        input.provider,
        input.body.event_id
      );
      if (!raced) throw error;
      return this.replay(raced, payloadHash);
    }
  }

  private replay(
    inbox: {
      id: string;
      state: string;
      payloadHash: string;
      errorCode: string | null;
    },
    payloadHash: string
  ) {
    if (inbox.payloadHash !== payloadHash) {
      throw new ConflictException('provider_event_payload_conflict');
    }
    if (inbox.errorCode) {
      throw new UnprocessableEntityException(inbox.errorCode);
    }
    return this.response(inbox, true);
  }

  private response(inbox: { id: string; state: string }, replayed: boolean) {
    return {
      inbox_id: inbox.id,
      state: inbox.state.toLowerCase(),
      idempotency_replayed: replayed,
    };
  }
}
