import crypto from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ServiceTokenClaims } from './service-auth.types';

type Jwk = Record<string, unknown> & {
  kid?: string;
  kty?: string;
  alg?: string;
};

const CANONICAL_ISSUER = 'https://auth.codestra.co/realms/codestra';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 30;

@Injectable()
export class ServiceTokenVerifier {
  private cachedKeys = new Map<string, Jwk>();
  private cacheExpiresAt = 0;

  async verifyAuthorizationHeader(header: string | undefined) {
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('service_bearer_token_required');
    }
    return this.verify(header.slice('Bearer '.length).trim());
  }

  async verify(token: string): Promise<ServiceTokenClaims> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('invalid_service_token');
    }

    const header = this.decodePart<{
      alg?: string;
      kid?: string;
      typ?: string;
    }>(parts[0]);
    const claims = this.decodePart<ServiceTokenClaims>(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) {
      throw new UnauthorizedException('unsupported_service_token');
    }

    const jwk = await this.keyFor(header.kid);
    const verified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      crypto.createPublicKey({ key: jwk, format: 'jwk' }),
      Buffer.from(parts[2], 'base64url')
    );
    if (!verified) {
      throw new UnauthorizedException('invalid_service_token_signature');
    }

    this.validateClaims(claims);
    return claims;
  }

  private decodePart<T>(value: string): T {
    try {
      return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
    } catch {
      throw new UnauthorizedException('invalid_service_token_encoding');
    }
  }

  private validateClaims(claims: ServiceTokenClaims) {
    const issuer = this.issuer();
    const audience = process.env.SERVICE_AUTH_AUDIENCE || 'codestra-social';
    const now = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];

    if (claims.iss !== issuer) {
      throw new UnauthorizedException('invalid_service_token_issuer');
    }
    if (!audiences.includes(audience)) {
      throw new UnauthorizedException('invalid_service_token_audience');
    }
    if (!Number.isFinite(claims.exp) || claims.exp < now - CLOCK_SKEW_SECONDS) {
      throw new UnauthorizedException('expired_service_token');
    }
    if (claims.nbf && claims.nbf > now + CLOCK_SKEW_SECONDS) {
      throw new UnauthorizedException('service_token_not_active');
    }
    if (!claims.sub || !claims.tenant_id) {
      throw new UnauthorizedException('service_token_claims_missing');
    }
  }

  private async keyFor(kid: string) {
    if (Date.now() >= this.cacheExpiresAt || !this.cachedKeys.has(kid)) {
      await this.refreshKeys();
    }
    const key = this.cachedKeys.get(kid);
    if (!key || key.kty !== 'RSA' || (key.alg && key.alg !== 'RS256')) {
      throw new UnauthorizedException('service_signing_key_not_found');
    }
    return key;
  }

  private async refreshKeys() {
    const response = await fetch(
      `${this.issuer()}/protocol/openid-connect/certs`,
      { signal: AbortSignal.timeout(3_000) }
    ).catch(() => undefined);
    if (!response?.ok) {
      throw new UnauthorizedException('service_jwks_unavailable');
    }
    const payload = (await response.json()) as { keys?: Jwk[] };
    const keys = new Map<string, Jwk>();
    for (const key of payload.keys || []) {
      if (key.kid) keys.set(key.kid, key);
    }
    if (!keys.size) {
      throw new UnauthorizedException('service_jwks_empty');
    }
    this.cachedKeys = keys;
    const configured = Number(process.env.SERVICE_AUTH_JWKS_CACHE_TTL_SECONDS);
    const ttl =
      Number.isFinite(configured) && configured > 0
        ? configured * 1000
        : DEFAULT_CACHE_TTL_MS;
    this.cacheExpiresAt = Date.now() + Math.min(ttl, 60 * 60 * 1000);
  }

  private issuer() {
    const issuer = (
      process.env.SERVICE_AUTH_ISSUER || CANONICAL_ISSUER
    ).replace(/\/$/, '');
    if (!issuer.startsWith('https://')) {
      throw new UnauthorizedException('https_service_issuer_required');
    }
    if (process.env.NODE_ENV === 'production' && issuer !== CANONICAL_ISSUER) {
      throw new UnauthorizedException('noncanonical_service_issuer');
    }
    return issuer;
  }
}
