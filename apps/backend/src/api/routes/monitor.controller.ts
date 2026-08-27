import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Request, Response } from 'express';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import net from 'node:net';

function metric(name: string, value: number, labels = '') {
  return `${name}${labels ? `{${labels}}` : ''} ${
    Number.isFinite(value) ? value : 0
  }\n`;
}

function tcpCheck(host: string, port: number, timeoutMs = 1500) {
  return new Promise<number>((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (value: number) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs, () => done(0));
    socket.once('connect', () => done(1));
    socket.once('error', () => done(0));
  });
}

@ApiTags('Monitor')
@Controller('/monitor')
export class MonitorController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('/live')
  live() {
    return { status: 'ok' };
  }

  @Get('/version')
  version() {
    return this.releaseIdentity();
  }

  @Get('/ready')
  async ready(@Res() response: Response) {
    const [postgresql, redis, temporal] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      ioRedis
        .ping()
        .then((reply) => reply === 'PONG')
        .catch(() => false),
      this.temporalUp().then((value) => value === 1),
    ]);
    const releaseIdentity = this.releaseIdentity();
    const releaseReady =
      process.env.NODE_ENV !== 'production' ||
      !Object.values(releaseIdentity).includes('unknown');
    const ready = postgresql && redis && temporal && releaseReady;
    return response.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      dependencies: { postgresql, redis, temporal },
      release_identity: releaseReady,
    });
  }

  @Get('/queue/:name')
  async getMessagesGroup(@Param('name') name: string) {
    return { status: 'success', queue: name };
  }

  @Get('/metrics')
  async metrics(@Req() req: Request, @Res() response: Response) {
    const allowed = (process.env.METRICS_ALLOWED_IPS || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (process.env.METRICS_ENABLED !== 'true' || !allowed.includes(req.ip)) {
      return response.status(404).json({ error: 'not_found' });
    }
    const safeCount = async (operation: Promise<number>) =>
      operation.catch(() => -1);
    const [
      pendingWebhooks,
      deadWebhooks,
      activeSessions,
      failedPosts,
      pendingSocialDeliveries,
      failedSocialDeliveries,
      pendingSocialOutbox,
      deadSocialOutbox,
      failedProviderInbox,
      oldestPendingOutbox,
      redisUp,
      temporalUp,
      elasticsearchUp,
    ] = await Promise.all([
      safeCount(
        this.prisma.webhookDeliveryAttempt.count({
          where: { state: { in: ['PENDING', 'RETRY_WAIT'] } },
        })
      ),
      safeCount(
        this.prisma.webhookDeadLetter.count({ where: { resolvedAt: null } })
      ),
      safeCount(
        this.prisma.authSession.count({
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
        })
      ),
      safeCount(
        this.prisma.post.count({
          where: { state: 'ERROR', deletedAt: null },
        })
      ),
      safeCount(
        this.prisma.socialDelivery.count({
          where: {
            state: {
              in: ['PENDING', 'PUBLISHING', 'PROVIDER_ACCEPTED', 'RETRY_WAIT'],
            },
          },
        })
      ),
      safeCount(
        this.prisma.socialDelivery.count({
          where: { state: { in: ['FAILED', 'DEAD_LETTERED'] } },
        })
      ),
      safeCount(
        this.prisma.socialOutboxEvent.count({
          where: { state: { in: ['PENDING', 'LEASED', 'RETRY_WAIT'] } },
        })
      ),
      safeCount(
        this.prisma.socialOutboxEvent.count({
          where: { state: 'DEAD_LETTERED' },
        })
      ),
      safeCount(
        this.prisma.socialProviderInbox.count({ where: { state: 'FAILED' } })
      ),
      this.prisma.socialOutboxEvent
        .findFirst({
          where: { state: { in: ['PENDING', 'LEASED', 'RETRY_WAIT'] } },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        })
        .then((event) =>
          event
            ? Math.max(0, (Date.now() - event.createdAt.getTime()) / 1000)
            : 0
        )
        .catch(() => -1),
      ioRedis
        .ping()
        .then((reply) => (reply === 'PONG' ? 1 : 0))
        .catch(() => 0),
      this.temporalUp(),
      process.env.ELASTICSEARCH_URL
        ? fetch(process.env.ELASTICSEARCH_URL, {
            method: 'HEAD',
            signal: AbortSignal.timeout(1500),
          })
            .then((result) => (result.ok ? 1 : 0))
            .catch(() => 0)
        : Promise.resolve(0),
    ]);
    const releaseLabels = [
      `commit="${(process.env.SOURCE_REVISION || 'unknown').replace(
        /[^a-zA-Z0-9._-]/g,
        ''
      )}"`,
      `image="${(process.env.IMAGE_DIGEST || 'unknown').replace(
        /[^a-zA-Z0-9:._@/-]/g,
        ''
      )}"`,
      `environment="${(process.env.NODE_ENV || 'unknown').replace(
        /[^a-zA-Z0-9._-]/g,
        ''
      )}"`,
      `version="${(process.env.IMAGE_VERSION || 'unknown').replace(
        /[^a-zA-Z0-9._-]/g,
        ''
      )}"`,
      `created="${(process.env.BUILD_CREATED || 'unknown').replace(
        /[^a-zA-Z0-9:._+-]/g,
        ''
      )}"`,
    ].join(',');
    const body = [
      '# HELP codestra_build_info Immutable release identity.\n# TYPE codestra_build_info gauge\n',
      metric('codestra_build_info', 1, releaseLabels),
      '# TYPE codestra_webhook_pending gauge\n',
      metric('codestra_webhook_pending', pendingWebhooks),
      '# TYPE codestra_webhook_dead_letters gauge\n',
      metric('codestra_webhook_dead_letters', deadWebhooks),
      '# TYPE codestra_active_sessions gauge\n',
      metric('codestra_active_sessions', activeSessions),
      '# TYPE codestra_publication_failures gauge\n',
      metric('codestra_publication_failures', failedPosts),
      '# TYPE codestra_social_delivery_pending gauge\n',
      metric('codestra_social_delivery_pending', pendingSocialDeliveries),
      '# TYPE codestra_social_delivery_failed gauge\n',
      metric('codestra_social_delivery_failed', failedSocialDeliveries),
      '# TYPE codestra_social_outbox_pending gauge\n',
      metric('codestra_social_outbox_pending', pendingSocialOutbox),
      '# TYPE codestra_social_outbox_dead_letters gauge\n',
      metric('codestra_social_outbox_dead_letters', deadSocialOutbox),
      '# TYPE codestra_social_provider_inbox_failed gauge\n',
      metric('codestra_social_provider_inbox_failed', failedProviderInbox),
      '# TYPE codestra_social_outbox_oldest_pending_seconds gauge\n',
      metric(
        'codestra_social_outbox_oldest_pending_seconds',
        oldestPendingOutbox
      ),
      '# TYPE codestra_social_safety_flag gauge\n',
      metric(
        'codestra_social_safety_flag',
        process.env.SOCIAL_PUBLISHING_ENABLED === 'true' ? 1 : 0,
        'flag="publishing_enabled"'
      ),
      metric(
        'codestra_social_safety_flag',
        process.env.ENABLE_EXTERNAL_DELIVERY === 'true' ? 1 : 0,
        'flag="external_delivery_enabled"'
      ),
      metric(
        'codestra_social_safety_flag',
        process.env.PUBLISHING_KILL_SWITCH === 'true' ? 1 : 0,
        'flag="publishing_kill_switch"'
      ),
      metric(
        'codestra_social_safety_flag',
        process.env.MIDDLEWARE_OUTBOX_ENABLED === 'true' ? 1 : 0,
        'flag="middleware_outbox_enabled"'
      ),
      '# TYPE codestra_dependency_up gauge\n',
      metric(
        'codestra_dependency_up',
        pendingWebhooks >= 0 ? 1 : 0,
        'dependency="postgresql"'
      ),
      metric('codestra_dependency_up', redisUp, 'dependency="redis"'),
      metric('codestra_dependency_up', temporalUp, 'dependency="temporal"'),
      metric(
        'codestra_dependency_up',
        elasticsearchUp,
        'dependency="elasticsearch"'
      ),
      '# TYPE codestra_ai_available gauge\n',
      metric('codestra_ai_available', process.env.OPENAI_API_KEY ? 1 : 0),
    ].join('');
    return response.type('text/plain; version=0.0.4').send(body);
  }

  private temporalUp() {
    const [host, port] = (process.env.TEMPORAL_ADDRESS || 'temporal:7233')
      .replace(/^https?:\/\//, '')
      .split(':');
    return tcpCheck(host, Number(port || '7233'));
  }

  private releaseIdentity() {
    return {
      source_revision: process.env.SOURCE_REVISION || 'unknown',
      image_digest: process.env.IMAGE_DIGEST || 'unknown',
      image_version: process.env.IMAGE_VERSION || 'unknown',
      build_created: process.env.BUILD_CREATED || 'unknown',
    };
  }
}
