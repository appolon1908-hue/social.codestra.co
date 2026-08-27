import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

type Dimension =
  | 'ip'
  | 'user'
  | 'session'
  | 'organization'
  | 'apiKey'
  | 'provider';
type Policy = {
  name: string;
  limit: number;
  windowSeconds: number;
  dimensions: Dimension[];
};

const configured = (name: string, fallback: number) => {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const POLICIES: Array<{
  match: (method: string, path: string) => boolean;
  policy: Policy;
}> = [
  {
    match: (m, p) => m === 'POST' && p.endsWith('/auth/login'),
    policy: {
      name: 'login-ip',
      limit: configured('RATE_LOGIN_PER_MINUTE_IP', 5),
      windowSeconds: 60,
      dimensions: ['ip'],
    },
  },
  {
    match: (m, p) => m === 'POST' && p.endsWith('/auth/login'),
    policy: {
      name: 'login-account',
      limit: configured('RATE_LOGIN_PER_HOUR_ACCOUNT', 20),
      windowSeconds: 3600,
      dimensions: ['user'],
    },
  },
  {
    match: (m, p) => m === 'POST' && p.endsWith('/auth/register'),
    policy: {
      name: 'registration',
      limit: 3,
      windowSeconds: 3600,
      dimensions: ['ip'],
    },
  },
  {
    match: (m, p) => m === 'POST' && p.endsWith('/auth/forgot'),
    policy: {
      name: 'password-reset',
      limit: 3,
      windowSeconds: 3600,
      dimensions: ['ip', 'user'],
    },
  },
  {
    match: (m, p) => m === 'POST' && p.endsWith('/auth/resend-activation'),
    policy: {
      name: 'verification-resend',
      limit: 3,
      windowSeconds: 3600,
      dimensions: ['ip', 'user'],
    },
  },
  {
    match: (m, p) => m === 'POST' && p.endsWith('/auth/refresh'),
    policy: {
      name: 'session-refresh',
      limit: 30,
      windowSeconds: 60,
      dimensions: ['session'],
    },
  },
  {
    match: (m, p) => m === 'POST' && p.includes('/api-key'),
    policy: {
      name: 'api-key-write',
      limit: 5,
      windowSeconds: 3600,
      dimensions: ['organization'],
    },
  },
  {
    match: (m, p) =>
      m === 'POST' && p.includes('/webhooks/') && p.endsWith('/test'),
    policy: {
      name: 'webhook-test',
      limit: 5,
      windowSeconds: 60,
      dimensions: ['organization'],
    },
  },
  {
    match: (m, p) =>
      m === 'POST' &&
      p.includes('/webhooks/dead-letters/') &&
      p.endsWith('/replay'),
    policy: {
      name: 'webhook-replay',
      limit: 10,
      windowSeconds: 3600,
      dimensions: ['organization'],
    },
  },
  {
    match: (m, p) =>
      m === 'POST' && p.includes('/oauth') && !p.includes('/callback'),
    policy: {
      name: 'oauth-initiation',
      limit: 10,
      windowSeconds: 60,
      dimensions: ['user'],
    },
  },
  {
    match: (m, p) => p.includes('/oauth') && p.includes('/callback'),
    policy: {
      name: 'oauth-callback',
      limit: 30,
      windowSeconds: 60,
      dimensions: ['ip'],
    },
  },
  {
    match: (m, p) => m === 'POST' && p.includes('/generate/image'),
    policy: {
      name: 'ai-image',
      limit: 5,
      windowSeconds: 60,
      dimensions: ['user'],
    },
  },
  {
    match: (m, p) => m === 'POST' && p.includes('/generate/video'),
    policy: {
      name: 'ai-video',
      limit: 2,
      windowSeconds: 3600,
      dimensions: ['user'],
    },
  },
  {
    match: (m, p) =>
      m === 'POST' && (p.includes('/copilot') || p.includes('/agent')),
    policy: {
      name: 'ai-text',
      limit: 20,
      windowSeconds: 60,
      dimensions: ['user'],
    },
  },
  {
    match: (m, p) => m === 'POST' && p.includes('/media'),
    policy: {
      name: 'media-upload',
      limit: 20,
      windowSeconds: 60,
      dimensions: ['user', 'organization'],
    },
  },
  {
    match: (m, p) => m === 'POST' && p.includes('/posts'),
    policy: {
      name: 'post-write',
      limit: 60,
      windowSeconds: 60,
      dimensions: ['organization', 'provider'],
    },
  },
  {
    match: (_m, p) => p.includes('/public/v1/'),
    policy: {
      name: 'public-api',
      limit: 300,
      windowSeconds: 60,
      dimensions: ['apiKey', 'organization'],
    },
  },
];

function digest(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  public override async canActivate(
    context: ExecutionContext
  ): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & Record<string, any>>();
    const res = context.switchToHttp().getResponse<Response>();
    const path = req.originalUrl.split('?')[0];
    const selectedPolicies = POLICIES.filter(({ match }) =>
      match(req.method, path)
    ).map(({ policy }) => policy);
    if (selectedPolicies.length === 0)
      selectedPolicies.push({
        name: 'global-api',
        limit: 300,
        windowSeconds: 60,
        dimensions: ['ip'] as const,
      });

    if (selectedPolicies.some(({ name }) => name === 'media-upload')) {
      const identity =
        this.dimensionValue(req, 'organization') ||
        this.dimensionValue(req, 'user') ||
        this.dimensionValue(req, 'ip');
      if (identity) {
        const concurrencyKey = `codestra:concurrency:media:${digest(identity)}`;
        const concurrent = await ioRedis.incr(concurrencyKey);
        if (concurrent === 1) await ioRedis.expire(concurrencyKey, 120);
        if (concurrent > configured('MEDIA_UPLOAD_CONCURRENCY', 2)) {
          await ioRedis.decr(concurrencyKey);
          res.setHeader('Retry-After', '2');
          throw new ThrottlerException('Media upload concurrency exceeded');
        }
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          void ioRedis.eval(
            "if redis.call('exists', KEYS[1]) == 1 then local value = redis.call('decr', KEYS[1]); if value <= 0 then redis.call('del', KEYS[1]); end; end; return 1",
            1,
            concurrencyKey
          );
        };
        res.once('finish', release);
        res.once('close', release);
      }
    }

    for (const selected of selectedPolicies) {
      for (const dimension of selected.dimensions) {
        const value = this.dimensionValue(req, dimension);
        if (!value) continue;
        const window = Math.floor(Date.now() / (selected.windowSeconds * 1000));
        const key = `codestra:rate:${selected.name}:${dimension}:${digest(
          value
        )}:${window}`;
        const penaltyKey = `codestra:rate:penalty:${
          selected.name
        }:${dimension}:${digest(value)}`;
        const existingPenalty = await ioRedis.ttl(penaltyKey);
        if (existingPenalty > 0) {
          res.setHeader('Retry-After', String(existingPenalty));
          throw new ThrottlerException('Rate limit exceeded');
        }
        const count = await ioRedis.incr(key);
        if (count === 1) await ioRedis.expire(key, selected.windowSeconds + 2);
        if (count > selected.limit) {
          const retryAfter = Math.min(
            selected.windowSeconds,
            2 ** Math.min(8, count - selected.limit)
          );
          await ioRedis.set(penaltyKey, '1', 'EX', retryAfter);
          res.setHeader('Retry-After', String(retryAfter));
          throw new ThrottlerException('Rate limit exceeded');
        }
      }
    }
    return true;
  }

  private dimensionValue(
    req: Request & Record<string, any>,
    dimension: string
  ): string | undefined {
    if (dimension === 'ip')
      return req.ip || req.socket.remoteAddress || undefined;
    if (dimension === 'user')
      return req.user?.id || req.body?.email?.toLowerCase();
    if (dimension === 'session')
      return req.cookies?.refresh || req.cookies?.auth;
    if (dimension === 'organization')
      return req.org?.id || (req.headers.showorg as string | undefined);
    if (dimension === 'apiKey')
      return req.headers.authorization as string | undefined;
    if (dimension === 'provider')
      return (
        req.params?.provider || req.body?.provider || req.body?.integration
      );
    return undefined;
  }
}
