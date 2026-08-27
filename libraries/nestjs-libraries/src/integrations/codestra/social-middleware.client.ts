import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import { Injectable } from '@nestjs/common';
import { SocialOutboxEvent } from '@prisma/client';

type TokenCache = { value: string; expiresAt: number };

@Injectable()
export class SocialMiddlewareClient {
  private tokenCache?: TokenCache;

  async deliver(event: SocialOutboxEvent) {
    const endpoint = this.endpoint();
    const token = await this.serviceToken();
    const body = Buffer.from(
      JSON.stringify({
        event_id: event.id,
        event_type: event.eventType,
        event_version: event.eventVersion,
        occurred_at: event.occurredAt.toISOString(),
        received_at: event.receivedAt.toISOString(),
        tenant_id: event.tenantId,
        correlation_id: event.correlationId,
        causation_id: event.causationId,
        payload: event.payload,
        metadata: event.metadata,
      })
    );
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': String(body.length),
      'Idempotency-Key': event.idempotencyKey,
      'X-Tenant-Id': event.tenantId,
      'X-Correlation-Id': event.correlationId,
      'X-Codestra-Event-Id': event.id,
      'X-Codestra-Timestamp': timestamp,
      'User-Agent': 'Codestra-Social-Outbox/1.0',
    };
    const signingSecret = this.optionalSecret(
      'MIDDLEWARE_EVENT_SIGNING_SECRET_FILE',
      'MIDDLEWARE_EVENT_SIGNING_SECRET'
    );
    if (process.env.MIDDLEWARE_HMAC_REQUIRED === 'true' && !signingSecret) {
      throw new Error('middleware_hmac_secret_required');
    }
    if (signingSecret) {
      headers['X-Codestra-Signature'] = `v1=${crypto
        .createHmac('sha256', signingSecret)
        .update(`${timestamp}.`)
        .update(body)
        .digest('hex')}`;
    }

    const response = await this.post(endpoint, body, headers);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`middleware_http_${response.status}`);
    }
    let acknowledgement: { accepted?: boolean; event_id?: string };
    try {
      acknowledgement = JSON.parse(response.body) as {
        accepted?: boolean;
        event_id?: string;
      };
    } catch {
      throw new Error('middleware_ack_invalid_json');
    }
    if (
      acknowledgement.accepted !== true ||
      acknowledgement.event_id !== event.id
    ) {
      throw new Error('middleware_ack_mismatch');
    }
  }

  private endpoint() {
    const value = process.env.CODESTRA_MIDDLEWARE_SOCIAL_EVENTS_URL;
    if (!value) throw new Error('middleware_social_events_url_required');
    const endpoint = new URL(value);
    if (
      endpoint.protocol !== 'https:' ||
      endpoint.username ||
      endpoint.password ||
      endpoint.hash ||
      endpoint.search
    ) {
      throw new Error('middleware_social_events_url_invalid');
    }
    return endpoint;
  }

  private async serviceToken() {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 30_000) {
      return this.tokenCache.value;
    }
    const issuer = (
      process.env.SERVICE_AUTH_ISSUER ||
      'https://auth.codestra.co/realms/codestra'
    ).replace(/\/$/, '');
    if (
      process.env.NODE_ENV === 'production' &&
      issuer !== 'https://auth.codestra.co/realms/codestra'
    ) {
      throw new Error('canonical_keycloak_issuer_required');
    }
    const clientId = process.env.MIDDLEWARE_CLIENT_ID;
    const clientSecret = this.optionalSecret(
      'MIDDLEWARE_CLIENT_SECRET_FILE',
      'MIDDLEWARE_CLIENT_SECRET'
    );
    if (!clientId || !clientSecret) {
      throw new Error('middleware_client_credentials_required');
    }
    const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: process.env.MIDDLEWARE_CLIENT_SCOPE || 'social.events.write',
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`keycloak_token_http_${response.status}`);
    const payload = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      token_type?: string;
    };
    if (
      !payload.access_token ||
      payload.token_type?.toLowerCase() !== 'bearer' ||
      !Number.isFinite(payload.expires_in)
    ) {
      throw new Error('keycloak_token_response_invalid');
    }
    this.tokenCache = {
      value: payload.access_token,
      expiresAt: Date.now() + Math.max(30, payload.expires_in!) * 1000,
    };
    return payload.access_token;
  }

  private post(endpoint: URL, body: Buffer, headers: Record<string, string>) {
    const tls = this.tlsOptions();
    return new Promise<{ status: number; body: string }>((resolve, reject) => {
      const request = https.request(
        endpoint,
        {
          method: 'POST',
          headers,
          timeout: 5_000,
          ...tls,
        },
        (response) => {
          const chunks: Buffer[] = [];
          let bytes = 0;
          response.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 64 * 1024) {
              response.destroy(new Error('middleware_response_too_large'));
              return;
            }
            chunks.push(chunk);
          });
          response.on('end', () =>
            resolve({
              status: response.statusCode || 0,
              body: Buffer.concat(chunks).toString('utf8'),
            })
          );
        }
      );
      request.on('timeout', () =>
        request.destroy(new Error('middleware_delivery_timeout'))
      );
      request.on('error', reject);
      request.end(body);
    });
  }

  private tlsOptions() {
    const cert = this.optionalFile('MIDDLEWARE_MTLS_CERT_FILE');
    const key = this.optionalFile('MIDDLEWARE_MTLS_KEY_FILE');
    const ca = this.optionalFile('MIDDLEWARE_MTLS_CA_FILE');
    if (process.env.MIDDLEWARE_MTLS_REQUIRED === 'true' && (!cert || !key)) {
      throw new Error('middleware_mtls_identity_required');
    }
    return { ...(cert && key ? { cert, key } : {}), ...(ca ? { ca } : {}) };
  }

  private optionalSecret(fileName: string, envName: string) {
    const file = process.env[fileName];
    if (file) return fs.readFileSync(file, 'utf8').trim();
    return process.env[envName]?.trim();
  }

  private optionalFile(name: string) {
    const file = process.env[name];
    return file ? fs.readFileSync(file) : undefined;
  }
}
