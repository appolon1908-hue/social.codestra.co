import crypto from 'node:crypto';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SocialMiddlewareOutboxDispatcher } from '@gitroom/nestjs-libraries/integrations/codestra/social-middleware-outbox.dispatcher';

@Injectable()
export class SocialMiddlewareOutboxWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SocialMiddlewareOutboxWorker.name);
  private readonly workerId = `social-outbox:${
    process.pid
  }:${crypto.randomUUID()}`;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly dispatcher: SocialMiddlewareOutboxDispatcher) {}

  onModuleInit() {
    if (process.env.MIDDLEWARE_OUTBOX_ENABLED !== 'true') {
      this.logger.warn('Middleware social outbox is disabled');
      return;
    }
    const interval = this.intervalMs();
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.dispatcher.dispatch(
        this.workerId,
        Number(process.env.MIDDLEWARE_OUTBOX_BATCH_SIZE || 20)
      );
      if (result.failed > 0) {
        this.logger.warn(
          `Middleware outbox processed=${result.processed} failed=${result.failed}`
        );
      }
    } catch (error) {
      this.logger.error(
        'Middleware outbox tick failed',
        error instanceof Error ? error.stack : undefined
      );
    } finally {
      this.running = false;
    }
  }

  private intervalMs() {
    const value = Number(
      process.env.MIDDLEWARE_OUTBOX_POLL_INTERVAL_MS || 1000
    );
    if (!Number.isInteger(value) || value < 250 || value > 60_000) {
      throw new Error('middleware_outbox_poll_interval_invalid');
    }
    return value;
  }
}
