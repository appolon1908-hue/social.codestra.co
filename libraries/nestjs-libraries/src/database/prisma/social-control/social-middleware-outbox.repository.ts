import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SocialOutboxEvent, SocialOutboxState } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Injectable()
export class SocialMiddlewareOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claimDue(workerId: string, limit = 20) {
    const now = new Date();
    const due = await this.prisma.socialOutboxEvent.findMany({
      where: {
        OR: [
          {
            state: { in: ['PENDING', 'RETRY_WAIT'] },
            AND: [
              {
                OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
              },
            ],
          },
          { state: 'LEASED', leaseExpiresAt: { lt: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    const claimed: SocialOutboxEvent[] = [];
    for (const event of due) {
      const result = await this.prisma.socialOutboxEvent.updateMany({
        where: {
          id: event.id,
          state: event.state,
          ...(event.state === 'LEASED'
            ? { leaseExpiresAt: event.leaseExpiresAt }
            : {}),
        },
        data: {
          state: 'LEASED',
          leaseOwner: workerId,
          leaseExpiresAt: new Date(Date.now() + 30_000),
        },
      });
      if (result.count === 1) {
        claimed.push({
          ...event,
          state: 'LEASED',
          leaseOwner: workerId,
          leaseExpiresAt: new Date(Date.now() + 30_000),
        });
      }
    }
    return claimed;
  }

  markDelivered(eventId: string, workerId: string) {
    return this.prisma.socialOutboxEvent.updateMany({
      where: { id: eventId, state: 'LEASED', leaseOwner: workerId },
      data: {
        state: 'DELIVERED',
        deliveredAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        errorCode: null,
      },
    });
  }

  recordFailure(
    event: Pick<SocialOutboxEvent, 'id' | 'attempt'>,
    workerId: string,
    errorCode: string,
    maxAttempts: number
  ) {
    const attempt = event.attempt + 1;
    const state: SocialOutboxState =
      attempt >= maxAttempts ? 'DEAD_LETTERED' : 'RETRY_WAIT';
    const baseDelay = Math.min(3600, 2 ** attempt * 15);
    const jitter = crypto.randomInt(0, 30);
    return this.prisma.socialOutboxEvent.updateMany({
      where: { id: event.id, state: 'LEASED', leaseOwner: workerId },
      data: {
        state,
        attempt,
        errorCode: errorCode.slice(0, 120),
        nextAttemptAt:
          state === 'RETRY_WAIT'
            ? new Date(Date.now() + (baseDelay + jitter) * 1000)
            : null,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
  }
}
