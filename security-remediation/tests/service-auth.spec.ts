import crypto from 'node:crypto';
import { ServiceTokenVerifier } from '@gitroom/nestjs-libraries/security/service-auth/service-token-verifier';

describe('Codestra service token verification', () => {
  const issuer = 'https://auth.codestra.co/realms/codestra';
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: 'jwk' });

  beforeEach(() => {
    process.env.SERVICE_AUTH_ISSUER = issuer;
    process.env.SERVICE_AUTH_AUDIENCE = 'codestra-social';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        keys: [{ ...jwk, kid: 'codestra-test-key', alg: 'RS256' }],
      }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts a signed Keycloak service token with the expected tenant', async () => {
    const verifier = new ServiceTokenVerifier();
    const claims = await verifier.verify(
      token({
        iss: issuer,
        aud: 'codestra-social',
        sub: 'middleware-service',
        azp: 'middleware-api',
        tenant_id: 'tenant-a',
        scope: 'social.commands.write social.commands.read',
        exp: Math.floor(Date.now() / 1000) + 300,
      })
    );

    expect(claims.tenant_id).toBe('tenant-a');
    expect(claims.azp).toBe('middleware-api');
  });

  it('rejects a token for a different audience', async () => {
    const verifier = new ServiceTokenVerifier();
    await expect(
      verifier.verify(
        token({
          iss: issuer,
          aud: 'another-service',
          sub: 'middleware-service',
          tenant_id: 'tenant-a',
          exp: Math.floor(Date.now() / 1000) + 300,
        })
      )
    ).rejects.toThrow('invalid_service_token_audience');
  });

  it('rejects expired tokens', async () => {
    const verifier = new ServiceTokenVerifier();
    await expect(
      verifier.verify(
        token({
          iss: issuer,
          aud: 'codestra-social',
          sub: 'middleware-service',
          tenant_id: 'tenant-a',
          exp: Math.floor(Date.now() / 1000) - 60,
        })
      )
    ).rejects.toThrow('expired_service_token');
  });

  function token(payload: Record<string, unknown>) {
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'codestra-test-key' })
    ).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey)
      .toString('base64url');
    return `${header}.${body}.${signature}`;
  }
});
