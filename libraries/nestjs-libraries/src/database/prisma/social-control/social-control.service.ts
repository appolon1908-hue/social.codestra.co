import crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SocialPublicationCommandDto } from '@gitroom/nestjs-libraries/dtos/social-control/social-publication-command.dto';
import {
  CreateSocialCommand,
  SocialControlRepository,
} from './social-control.repository';
import { ServiceAuthContext } from '@gitroom/nestjs-libraries/security/service-auth/service-auth.types';

@Injectable()
export class SocialControlService {
  constructor(private readonly repository: SocialControlRepository) {}

  async acceptPublication(
    auth: ServiceAuthContext,
    idempotencyKey: string | undefined,
    input: SocialPublicationCommandDto
  ) {
    if (
      !idempotencyKey ||
      idempotencyKey.length < 16 ||
      idempotencyKey.length > 200
    ) {
      throw new BadRequestException('valid_idempotency_key_required');
    }
    if (
      input.schedule_at &&
      new Date(input.schedule_at).getTime() < Date.now() - 60_000
    ) {
      throw new UnprocessableEntityException('schedule_at_is_in_the_past');
    }

    const payloadHash = this.payloadHash(input);
    const existing = await this.repository.findCommandByIdempotency(
      auth.tenantId,
      idempotencyKey
    );
    if (existing) {
      return this.replayed(existing, payloadHash);
    }

    const accounts = await this.repository.validateTargets(
      auth.tenantId,
      input.targets
    );
    for (const target of input.targets) {
      const account = accounts.get(target.account_id);
      if (!account) {
        throw new UnprocessableEntityException(
          `social_account_unavailable:${target.account_id}`
        );
      }
      if (account.providerIdentifier !== target.provider) {
        throw new UnprocessableEntityException(
          `social_provider_mismatch:${target.account_id}`
        );
      }
    }

    const create: CreateSocialCommand = {
      tenantId: auth.tenantId,
      correlationId: auth.correlationId,
      idempotencyKey,
      payloadHash,
      publishingEnabled: this.publishingEnabled(),
      input,
    };
    try {
      const created = await this.repository.createCommand(create);
      return this.accepted(created, false);
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const raced = await this.repository.findCommandByIdempotency(
        auth.tenantId,
        idempotencyKey
      );
      if (!raced) throw error;
      return this.replayed(raced, payloadHash);
    }
  }

  async command(auth: ServiceAuthContext, commandId: string) {
    const command = await this.repository.findCommand(auth.tenantId, commandId);
    if (!command) throw new NotFoundException('social_command_not_found');
    return this.commandResponse(command);
  }

  async delivery(auth: ServiceAuthContext, deliveryId: string) {
    const delivery = await this.repository.findDelivery(
      auth.tenantId,
      deliveryId
    );
    if (!delivery) throw new NotFoundException('social_delivery_not_found');
    return this.deliveryResponse(delivery);
  }

  private replayed(
    command: Awaited<ReturnType<SocialControlRepository['findCommand']>> & {},
    payloadHash: string
  ) {
    if (command.payloadHash !== payloadHash) {
      throw new ConflictException('idempotency_payload_conflict');
    }
    return this.accepted(command, true);
  }

  private accepted(
    command: Awaited<ReturnType<SocialControlRepository['findCommand']>> & {},
    replayed: boolean
  ) {
    return {
      command_id: command.id,
      state: command.state.toLowerCase(),
      idempotency_replayed: replayed,
      publishing_enabled: command.publishingEnabledAtAcceptance,
      deliveries: command.deliveries.map((delivery) =>
        this.deliveryResponse(delivery)
      ),
    };
  }

  private commandResponse(
    command: Awaited<ReturnType<SocialControlRepository['findCommand']>> & {}
  ) {
    return {
      command_id: command.id,
      command_version: command.commandVersion,
      requested_by: command.requestedBy,
      correlation_id: command.correlationId,
      state: command.state.toLowerCase(),
      schedule_at: command.scheduleAt,
      publishing_enabled_at_acceptance: command.publishingEnabledAtAcceptance,
      error_code: command.errorCode,
      created_at: command.createdAt,
      updated_at: command.updatedAt,
      deliveries: command.deliveries.map((delivery) =>
        this.deliveryResponse(delivery)
      ),
    };
  }

  private deliveryResponse(delivery: {
    id: string;
    accountId: string;
    provider: string;
    state: string;
    attempt: number;
    providerPostId: string | null;
    reconciledAt: Date | null;
    errorCode: string | null;
    nextAttemptAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      delivery_id: delivery.id,
      account_id: delivery.accountId,
      provider: delivery.provider,
      state: delivery.state.toLowerCase(),
      attempt: delivery.attempt,
      provider_post_id: delivery.providerPostId,
      reconciled_at: delivery.reconciledAt,
      error_code: delivery.errorCode,
      next_attempt_at: delivery.nextAttemptAt,
      created_at: delivery.createdAt,
      updated_at: delivery.updatedAt,
    };
  }

  private payloadHash(input: SocialPublicationCommandDto) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(this.canonical(input)))
      .digest('hex');
  }

  private canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.canonical(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, this.canonical(item)])
      );
    }
    return value;
  }

  private publishingEnabled() {
    return (
      process.env.SOCIAL_PUBLISHING_ENABLED === 'true' &&
      process.env.ENABLE_EXTERNAL_DELIVERY === 'true' &&
      process.env.PUBLISHING_KILL_SWITCH !== 'true'
    );
  }
}
