import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Request, Response } from 'express';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import net from 'node:net';
import { isRuntimeCapabilityEnabled } from '@gitroom/helpers/configuration/runtime-capabilities';

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
      ioRedis
        .ping()
        .then((reply) => (reply === 'PONG' ? 1 : 0))
        .catch(() => 0),
      (() => {
        const [host, port] = (process.env.TEMPORAL_ADDRESS || 'temporal:7233')
          .replace(/^https?:\/\//, '')
          .split(':');
        return tcpCheck(host, Number(port || '7233'));
      })(),
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
      metric(
        'codestra_ai_available',
        isRuntimeCapabilityEnabled('EXTERNAL_MODEL_CALLS_ENABLED') &&
          process.env.OPENAI_API_KEY
          ? 1
          : 0
      ),
      '# TYPE codestra_runtime_capability_enabled gauge\n',
      metric(
        'codestra_runtime_capability_enabled',
        isRuntimeCapabilityEnabled('BILLING_LIVE_CHARGE') ? 1 : 0,
        'capability="billing_live_charge"'
      ),
      metric(
        'codestra_runtime_capability_enabled',
        isRuntimeCapabilityEnabled('EXTERNAL_MODEL_CALLS_ENABLED') ? 1 : 0,
        'capability="external_model_calls"'
      ),
      metric(
        'codestra_runtime_capability_enabled',
        isRuntimeCapabilityEnabled('WEBHOOK_DELIVERY_ENABLED') ? 1 : 0,
        'capability="webhook_delivery"'
      ),
      metric(
        'codestra_runtime_capability_enabled',
        process.env.PUBLISHING_KILL_SWITCH === 'false' ? 1 : 0,
        'capability="social_publishing"'
      ),
    ].join('');
    return response.type('text/plain; version=0.0.4').send(body);
  }
}
