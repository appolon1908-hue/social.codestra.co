import { Injectable } from '@nestjs/common';
import { SocialMiddlewareOutboxRepository } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-middleware-outbox.repository';
import { SocialMiddlewareClient } from './social-middleware.client';

@Injectable()
export class SocialMiddlewareOutboxDispatcher {
  constructor(
    private readonly repository: SocialMiddlewareOutboxRepository,
    private readonly client: SocialMiddlewareClient
  ) {}

  async dispatch(workerId: string, limit = 20) {
    if (process.env.MIDDLEWARE_OUTBOX_ENABLED !== 'true') {
      return { disabled: true, processed: 0, delivered: 0, failed: 0 };
    }
    const maxAttempts = this.maxAttempts();
    const events = await this.repository.claimDue(workerId, limit);
    let delivered = 0;
    let failed = 0;
    for (const event of events) {
      try {
        await this.client.deliver(event);
        const updated = await this.repository.markDelivered(event.id, workerId);
        if (updated.count !== 1) throw new Error('outbox_lease_lost');
        delivered++;
      } catch (error) {
        failed++;
        const errorCode =
          error instanceof Error ? error.message : 'middleware_delivery_failed';
        await this.repository.recordFailure(
          event,
          workerId,
          errorCode,
          maxAttempts
        );
      }
    }
    return { disabled: false, processed: events.length, delivered, failed };
  }

  private maxAttempts() {
    const value = Number(process.env.MIDDLEWARE_OUTBOX_MAX_ATTEMPTS || 8);
    if (!Number.isInteger(value) || value < 1 || value > 20) {
      throw new Error('middleware_outbox_max_attempts_invalid');
    }
    return value;
  }
}
