import crypto from 'node:crypto';
import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class SocialProviderWebhookVerifier {
  verify(input: {
    tenantId: string;
    provider: string;
    timestamp: string | undefined;
    signature: string | undefined;
    rawBody: Buffer;
    now?: number;
  }) {
    if (process.env.SOCIAL_PROVIDER_CALLBACKS_ENABLED !== 'true') {
      throw new ServiceUnavailableException('provider_callbacks_disabled');
    }

    const timestamp = Number(input.timestamp);
    const now = input.now ?? Date.now();
    const toleranceSeconds = this.toleranceSeconds();
    if (
      !Number.isInteger(timestamp) ||
      Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSeconds
    ) {
      throw new UnauthorizedException('provider_callback_timestamp_invalid');
    }

    const supplied = input.signature?.match(/^v1=([a-f0-9]{64})$/i)?.[1];
    if (!supplied) {
      throw new UnauthorizedException('provider_callback_signature_invalid');
    }

    const secret = this.secret(input.tenantId, input.provider);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(input.rawBody)
      .digest();
    const received = Buffer.from(supplied, 'hex');
    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException('provider_callback_signature_invalid');
    }
  }

  private secret(tenantId: string, provider: string) {
    let secrets: Record<string, unknown>;
    try {
      secrets = JSON.parse(
        process.env.SOCIAL_PROVIDER_WEBHOOK_SECRETS_JSON || '{}'
      ) as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException(
        'provider_callback_secret_configuration_invalid'
      );
    }
    const secret = secrets[`${tenantId}:${provider}`];
    if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
      throw new ServiceUnavailableException(
        'provider_callback_secret_unavailable'
      );
    }
    return secret;
  }

  private toleranceSeconds() {
    const configured = Number(
      process.env.SOCIAL_PROVIDER_WEBHOOK_TOLERANCE_SECONDS || 300
    );
    if (!Number.isInteger(configured) || configured < 30 || configured > 900) {
      throw new ServiceUnavailableException(
        'provider_callback_tolerance_configuration_invalid'
      );
    }
    return configured;
  }
}
