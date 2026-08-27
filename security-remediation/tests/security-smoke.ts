import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { SessionService } from '@gitroom/nestjs-libraries/security/session.service';
import {
  decryptSecret,
  encryptSecret,
} from '@gitroom/helpers/security/envelope.crypto';
import {
  generateApiKey,
  hashApiKey,
} from '@gitroom/helpers/security/api-key';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

async function main() {
  const plaintext = 'synthetic-secret-' + crypto.randomUUID();
  const first = encryptSecret(plaintext, 'security-smoke');
  const second = encryptSecret(plaintext, 'security-smoke');
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.equal(decryptSecret(first, 'security-smoke'), plaintext);
  assert.throws(() => decryptSecret(first, 'wrong-context'));

  const apiKey = generateApiKey();
  assert.match(apiKey.value, /^cds_[A-Za-z0-9_-]{40,}$/);
  assert.equal(hashApiKey(apiKey.value), apiKey.hash);
  assert.equal(apiKey.lastFour, apiKey.value.slice(-4));
  assert.equal(apiKey.hash.includes(apiKey.value), false);

  const prisma = new PrismaService();
  await prisma.$connect();
  const suffix = crypto.randomUUID();
  const organization = await prisma.organization.create({
    data: { name: `Synthetic security test ${suffix}` },
  });
  const user = await prisma.user.create({
    data: {
      email: `security-${suffix}@example.invalid`,
      providerName: 'LOCAL',
      timezone: 0,
      password: AuthService.hashPassword(crypto.randomBytes(24).toString('base64url')),
    },
  });

  try {
    const sessions = new SessionService(prisma);
    const created = await sessions.create(user.id, organization.id, '192.0.2.10', 'Codestra security test');
    const access = AuthService.verifyJWT(created.accessToken) as Record<string, unknown>;
    assert.equal(access.sub, user.id);
    assert.equal(access.aud, process.env.JWT_AUDIENCE || 'codestra-social');
    assert.equal(access.iss, process.env.JWT_ISSUER || 'https://social.codestra.co');
    assert.ok(typeof access.jti === 'string');
    assert.ok(Number(access.exp) - Number(access.iat) <= 15 * 60);

    const rotated = await sessions.rotate(created.refreshToken);
    assert.notEqual(rotated.refreshToken, created.refreshToken);
    await assert.rejects(() => sessions.rotate(created.refreshToken), /reuse/i);
    const activeAfterReuse = await prisma.authSession.count({
      where: { userId: user.id, revokedAt: null },
    });
    assert.equal(activeAfterReuse, 0);
  } finally {
    await prisma.authSession.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.$disconnect();
  }

  process.stdout.write('SECURITY_SMOKE_GATE=PASS\n');
}

main().catch((error) => {
  process.stderr.write(`SECURITY_SMOKE_GATE=FAIL ${error instanceof Error ? error.message : 'unknown'}\n`);
  process.exitCode = 1;
});
