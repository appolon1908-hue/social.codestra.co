import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import https from 'node:https';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { decryptSecret, encryptSecret } from '@gitroom/helpers/security/envelope.crypto';
import { isBlockedIp, isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';

const MAX_ATTEMPTS = 5;
const MAX_RESPONSE_BYTES = 64 * 1024;
const DELIVERY_TIMEOUT_MS = 5_000;

@Injectable()
export class SecureWebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async createSubscription(organizationId: string, input: {
    name: string;
    url: string;
    eventTypes: string[];
  }) {
    if (!(await isSafePublicHttpsUrl(input.url))) throw new Error('unsafe_webhook_destination');
    const secret = `whsec_${crypto.randomBytes(32).toString('base64url')}`;
    const encrypted = encryptSecret(secret, `webhook:${organizationId}:signing-secret`);
    const subscription = await this.prisma.webhookSubscription.create({
      data: {
        organizationId,
        name: input.name,
        url: input.url,
        enabled: false,
        eventTypes: [...new Set(input.eventTypes)].slice(0, 50),
        secretVersions: {
          create: {
            ciphertext: encrypted.ciphertext,
            nonce: encrypted.nonce,
            keyVersion: encrypted.keyVersion,
            fingerprint: encrypted.fingerprint,
          },
        },
      },
      select: { id: true, name: true, url: true, enabled: true, eventTypes: true, createdAt: true },
    });
    return { subscription, secret };
  }

  listSubscriptions(organizationId: string) {
    return this.prisma.webhookSubscription.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true, name: true, url: true, enabled: true, eventTypes: true,
        createdAt: true, updatedAt: true,
        secretVersions: {
          where: { revokedAt: null }, take: 1, orderBy: { createdAt: 'desc' },
          select: { fingerprint: true, createdAt: true, expiresAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setEnabled(organizationId: string, id: string, enabled: boolean) {
    if (enabled && process.env.WEBHOOK_DELIVERY_ENABLED !== 'true') {
      throw new Error('webhook_delivery_disabled');
    }
    return this.prisma.webhookSubscription.update({
      where: { id, organizationId, deletedAt: null },
      data: { enabled },
      select: { id: true, enabled: true, updatedAt: true },
    });
  }

  async updateSubscription(organizationId: string, id: string, input: { name: string; url: string; eventTypes: string[] }) {
    if (!(await isSafePublicHttpsUrl(input.url))) throw new Error('unsafe_webhook_destination');
    return this.prisma.webhookSubscription.update({
      where: { id, organizationId, deletedAt: null },
      data: { name: input.name, url: input.url, eventTypes: [...new Set(input.eventTypes)].slice(0, 50) },
      select: { id: true, name: true, url: true, enabled: true, eventTypes: true, updatedAt: true },
    });
  }

  deleteSubscription(organizationId: string, id: string) {
    return this.prisma.webhookSubscription.update({
      where: { id, organizationId },
      data: { enabled: false, deletedAt: new Date() },
      select: { id: true, deletedAt: true },
    });
  }

  async enqueueEvent(organizationId: string, eventType: string, payload: object, eventId = crypto.randomUUID()) {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: { organizationId, enabled: true, deletedAt: null, eventTypes: { has: eventType } },
      select: { id: true },
    });
    await this.prisma.webhookEvent.create({
      data: {
        id: eventId,
        organizationId,
        eventType,
        version: 1,
        payload,
        deliveries: {
          create: subscriptions.map(({ id }) => ({ subscriptionId: id, attempt: 1 })),
        },
      },
    });
    return { eventId, queued: subscriptions.length };
  }

  async enqueueForSubscription(
    organizationId: string,
    subscriptionId: string,
    eventType: string,
    payload: object
  ) {
    const subscription = await this.prisma.webhookSubscription.findFirstOrThrow({
      where: { id: subscriptionId, organizationId, enabled: true, deletedAt: null },
      select: { id: true },
    });
    const eventId = crypto.randomUUID();
    await this.prisma.webhookEvent.create({
      data: {
        id: eventId,
        organizationId,
        eventType,
        version: 1,
        payload,
        deliveries: { create: { subscriptionId: subscription.id, attempt: 1 } },
      },
    });
    return { eventId, queued: 1 };
  }

  async replayDeadLetter(
    organizationId: string,
    deadLetterId: string,
    actorUserId: string,
    reason: string
  ) {
    if (process.env.WEBHOOK_DELIVERY_ENABLED !== 'true') {
      throw new Error('webhook_delivery_disabled');
    }
    const deadLetter = await this.prisma.webhookDeadLetter.findFirstOrThrow({
      where: {
        id: deadLetterId,
        resolvedAt: null,
        subscription: { organizationId, enabled: true, deletedAt: null },
      },
      include: {
        subscription: { select: { id: true } },
      },
    });
    const failedAttempt = await this.prisma.webhookDeliveryAttempt.findFirstOrThrow({
      where: {
        eventId: deadLetter.eventId,
        subscriptionId: deadLetter.subscription.id,
        state: 'DEAD_LETTER',
      },
      orderBy: { attempt: 'desc' },
    });
    await this.prisma.$transaction([
      this.prisma.webhookDeadLetter.update({
        where: { id: deadLetter.id },
        data: { resolvedAt: new Date() },
      }),
      this.prisma.webhookDeliveryAttempt.update({
        where: { id: failedAttempt.id },
        data: {
          state: 'RETRY_WAIT',
          nextAttemptAt: new Date(),
          startedAt: null,
          completedAt: null,
          responseCode: null,
          responseBytes: null,
          errorCode: null,
        },
      }),
      this.prisma.webhookReplayAudit.create({
        data: {
          deadLetterId: deadLetter.id,
          actorUserId,
          reason: reason.slice(0, 500),
        },
      }),
    ]);
    return { accepted: true, eventId: deadLetter.eventId };
  }

  deliveryHistory(organizationId: string, subscriptionId: string) {
    return this.prisma.webhookDeliveryAttempt.findMany({
      where: { subscriptionId, subscription: { organizationId } },
      select: {
        id: true, eventId: true, attempt: true, state: true, nextAttemptAt: true,
        startedAt: true, completedAt: true, responseCode: true, errorCode: true,
        responseBytes: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
  }

  async deliverDue(limit = 20) {
    if (process.env.WEBHOOK_DELIVERY_ENABLED !== 'true') return { delivered: 0, disabled: true };
    const due = await this.prisma.webhookDeliveryAttempt.findMany({
      where: {
        state: { in: ['PENDING', 'RETRY_WAIT'] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        subscription: { enabled: true, deletedAt: null },
      },
      orderBy: { createdAt: 'asc' }, take: Math.min(limit, 100),
      include: {
        event: true,
        subscription: { include: { secretVersions: { where: { revokedAt: null }, orderBy: { createdAt: 'desc' }, take: 2 } } },
      },
    });
    let delivered = 0;
    for (const attempt of due) {
      const claimed = await this.prisma.webhookDeliveryAttempt.updateMany({
        where: { id: attempt.id, state: attempt.state },
        data: { state: 'DELIVERING', startedAt: new Date() },
      });
      if (claimed.count !== 1) continue;
      const body = Buffer.from(JSON.stringify({
        id: attempt.event.id,
        type: attempt.event.eventType,
        version: attempt.event.version,
        created_at: attempt.event.createdAt.toISOString(),
        data: attempt.event.payload,
      }));
      try {
        const secretVersion = attempt.subscription.secretVersions[0];
        if (!secretVersion) throw new Error('missing_signing_secret');
        const secret = decryptSecret({
          ciphertext: secretVersion.ciphertext,
          nonce: secretVersion.nonce,
          keyVersion: secretVersion.keyVersion,
          fingerprint: secretVersion.fingerprint,
        }, `webhook:${attempt.subscription.organizationId}:signing-secret`);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
        const result = await this.postPinned(attempt.subscription.url, body, {
          'Content-Type': 'application/json',
          'User-Agent': 'Codestra-Webhook/1.0',
          'X-Codestra-Event-ID': attempt.event.id,
          'X-Codestra-Event-Type': attempt.event.eventType,
          'X-Codestra-Timestamp': timestamp,
          'X-Codestra-Signature': `v1=${signature}`,
        });
        if (result.status < 200 || result.status >= 300) throw Object.assign(new Error('non_success_response'), { status: result.status, responseBytes: result.bytes });
        await this.prisma.webhookDeliveryAttempt.update({
          where: { id: attempt.id },
          data: { state: 'DELIVERED', completedAt: new Date(), responseCode: result.status, responseBytes: result.bytes },
        });
        delivered++;
      } catch (error) {
        await this.recordFailure(attempt, error);
      }
    }
    return { delivered, processed: due.length };
  }

  private async recordFailure(attempt: { id: string; eventId: string; subscriptionId: string; attempt: number }, error: unknown) {
    const errorCode = error instanceof Error ? error.message.slice(0, 80) : 'delivery_failed';
    const responseCode = typeof (error as any)?.status === 'number' ? (error as any).status : null;
    const responseBytes = typeof (error as any)?.responseBytes === 'number' ? (error as any).responseBytes : null;
    if (attempt.attempt >= MAX_ATTEMPTS) {
      await this.prisma.$transaction([
        this.prisma.webhookDeliveryAttempt.update({ where: { id: attempt.id }, data: { state: 'DEAD_LETTER', completedAt: new Date(), responseCode, responseBytes, errorCode } }),
        this.prisma.webhookDeadLetter.upsert({
          where: { eventId_subscriptionId: { eventId: attempt.eventId, subscriptionId: attempt.subscriptionId } },
          create: { eventId: attempt.eventId, subscriptionId: attempt.subscriptionId, reasonCode: errorCode },
          update: { reasonCode: errorCode, resolvedAt: null },
        }),
      ]);
      return;
    }
    const delaySeconds = Math.min(3600, 2 ** attempt.attempt * 30) + crypto.randomInt(0, 30);
    await this.prisma.$transaction([
      this.prisma.webhookDeliveryAttempt.update({ where: { id: attempt.id }, data: { state: 'CANCELLED', completedAt: new Date(), responseCode, responseBytes, errorCode } }),
      this.prisma.webhookDeliveryAttempt.create({
        data: {
          eventId: attempt.eventId, subscriptionId: attempt.subscriptionId,
          attempt: attempt.attempt + 1, state: 'RETRY_WAIT',
          nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
        },
      }),
    ]);
  }

  private async postPinned(urlValue: string, body: Buffer, headers: Record<string, string>) {
    const parsed = new URL(urlValue);
    if (parsed.protocol !== 'https:') throw new Error('https_required');
    const addresses = await dns.lookup(parsed.hostname, { all: true });
    if (!addresses.length || addresses.some(({ address }) => isBlockedIp(address))) throw new Error('unsafe_webhook_destination');
    const selected = addresses[0];
    return new Promise<{ status: number; bytes: number }>((resolve, reject) => {
      const request = https.request({
        protocol: 'https:', hostname: parsed.hostname, port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`, method: 'POST', headers: { ...headers, 'Content-Length': String(body.length) },
        timeout: DELIVERY_TIMEOUT_MS,
        lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family),
      }, (response) => {
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_RESPONSE_BYTES) response.destroy(new Error('response_too_large'));
        });
        response.on('end', () => resolve({ status: response.statusCode || 0, bytes }));
      });
      request.on('timeout', () => request.destroy(new Error('delivery_timeout')));
      request.on('error', reject);
      request.end(body);
    });
  }
}
