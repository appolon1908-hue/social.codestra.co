import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { SecureWebhooksService } from '@gitroom/nestjs-libraries/security/secure-webhooks.service';
import { encryptSecret } from '@gitroom/helpers/security/envelope.crypto';

type Dispatch = (
  url: string,
  body: Buffer,
  headers: Record<string, string>
) => Promise<{ status: number; bytes: number }>;

async function main() {
  process.env.WEBHOOK_DELIVERY_ENABLED = 'true';
  const prisma = new PrismaService();
  await prisma.$connect();
  const suffix = crypto.randomUUID();
  const secret = `whsec_${crypto.randomBytes(32).toString('base64url')}`;
  const organization = await prisma.organization.create({
    data: { name: `Synthetic webhook test ${suffix}` },
  });
  const user = await prisma.user.create({
    data: {
      email: `webhook-${suffix}@example.invalid`,
      providerName: 'LOCAL',
      timezone: 0,
    },
  });
  const encrypted = encryptSecret(
    secret,
    `webhook:${organization.id}:signing-secret`
  );
  const subscription = await prisma.webhookSubscription.create({
    data: {
      organizationId: organization.id,
      name: 'Synthetic controlled receiver',
      url: 'https://receiver.example.invalid/codestra',
      enabled: true,
      eventTypes: ['security.test'],
      secretVersions: { create: encrypted },
    },
  });
  const service = new SecureWebhooksService(prisma);
  const patchDispatch = (dispatch: Dispatch) => {
    (service as unknown as { postPinned: Dispatch }).postPinned = dispatch;
  };

  try {
    let observedBody = Buffer.alloc(0);
    patchDispatch(async (_url, body, headers) => {
      observedBody = body;
      const timestamp = headers['X-Codestra-Timestamp'];
      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.`)
        .update(body)
        .digest('hex');
      assert.equal(headers['X-Codestra-Signature'], `v1=${expected}`);
      assert.equal(headers['X-Codestra-Event-ID'].length > 10, true);
      return { status: 204, bytes: 0 };
    });
    const queued = await service.enqueueForSubscription(
      organization.id,
      subscription.id,
      'security.test',
      { synthetic: true }
    );
    assert.equal(queued.queued, 1);
    assert.equal((await service.deliverDue()).delivered, 1);
    assert.equal(JSON.parse(observedBody.toString()).data.synthetic, true);

    patchDispatch(async () => {
      throw new Error('synthetic_timeout');
    });
    const retry = await service.enqueueForSubscription(
      organization.id,
      subscription.id,
      'security.test',
      { synthetic_retry: true }
    );
    await service.deliverDue();
    const retryAttempts = await prisma.webhookDeliveryAttempt.findMany({
      where: { eventId: retry.eventId },
      orderBy: { attempt: 'asc' },
    });
    assert.deepEqual(retryAttempts.map((entry) => entry.state), [
      'CANCELLED',
      'RETRY_WAIT',
    ]);

    const deadEventId = crypto.randomUUID();
    await prisma.webhookEvent.create({
      data: {
        id: deadEventId,
        organizationId: organization.id,
        eventType: 'security.test',
        version: 1,
        payload: { synthetic_dead_letter: true },
        deliveries: {
          create: { subscriptionId: subscription.id, attempt: 5 },
        },
      },
    });
    await service.deliverDue();
    const deadLetter = await prisma.webhookDeadLetter.findUniqueOrThrow({
      where: {
        eventId_subscriptionId: {
          eventId: deadEventId,
          subscriptionId: subscription.id,
        },
      },
    });
    patchDispatch(async () => ({ status: 200, bytes: 2 }));
    await service.replayDeadLetter(
      organization.id,
      deadLetter.id,
      user.id,
      'Synthetic authorized recovery test'
    );
    assert.equal((await service.deliverDue()).delivered, 1);
    assert.equal(
      await prisma.webhookReplayAudit.count({
        where: { deadLetterId: deadLetter.id, actorUserId: user.id },
      }),
      1
    );
  } finally {
    await prisma.webhookEvent.deleteMany({
      where: { organizationId: organization.id },
    });
    await prisma.webhookSubscription.deleteMany({
      where: { organizationId: organization.id },
    });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.$disconnect();
  }
  process.stdout.write('WEBHOOK_SMOKE_GATE=PASS\n');
}

main().catch((error) => {
  process.stderr.write(`WEBHOOK_SMOKE_GATE=FAIL ${error instanceof Error ? error.message : 'unknown'}\n`);
  process.exitCode = 1;
});
