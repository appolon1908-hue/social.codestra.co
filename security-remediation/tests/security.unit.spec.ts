import crypto from 'node:crypto';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import {
  decryptSecret,
  encryptSecret,
} from '@gitroom/helpers/security/envelope.crypto';
import { generateApiKey, hashApiKey } from '@gitroom/helpers/security/api-key';

describe('Codestra security primitives', () => {
  beforeAll(() => {
    process.env.DATA_ENCRYPTION_KEY_V1 = crypto
      .randomBytes(32)
      .toString('base64');
    process.env.JWT_SIGNING_KEY = crypto.randomBytes(48).toString('base64');
    process.env.API_KEY_PEPPER = crypto.randomBytes(48).toString('base64');
  });

  afterAll(() => {
    delete process.env.DATA_ENCRYPTION_KEY_V1;
    delete process.env.JWT_SIGNING_KEY;
    delete process.env.API_KEY_PEPPER;
  });

  it('uses randomized authenticated encryption with context binding', () => {
    const value = `synthetic-${crypto.randomUUID()}`;
    const first = encryptSecret(value, 'unit-test');
    const second = encryptSecret(value, 'unit-test');

    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(decryptSecret(first, 'unit-test')).toBe(value);
    expect(() => decryptSecret(first, 'wrong-context')).toThrow();
  });

  it('stores API-key verification material without the key', () => {
    const generated = generateApiKey();

    expect(generated.value).toMatch(/^cds_[A-Za-z0-9_-]{40,}$/);
    expect(hashApiKey(generated.value)).toBe(generated.hash);
    expect(generated.hash).not.toContain(generated.value);
    expect(generated.lastFour).toBe(generated.value.slice(-4));
  });

  it('issues bounded, uniquely identified access tokens', () => {
    const token = AuthService.signJWT({
      sub: 'synthetic-user',
      securityVersion: 2,
    });
    const claims = AuthService.verifyJWT(token) as Record<string, unknown>;

    expect(claims.iss).toBe('https://social.codestra.co');
    expect(claims.aud).toBe('codestra-social');
    expect(typeof claims.jti).toBe('string');
    expect(Number(claims.exp) - Number(claims.iat)).toBeLessThanOrEqual(900);
  });
});
