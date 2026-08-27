import crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { ServiceAuthContext } from '@gitroom/nestjs-libraries/security/service-auth/service-auth.types';
import {
  SocialApprovalDecisionDto,
  SocialApprovalPolicyDto,
  SocialApprovalRequestDto,
  SocialExternalReviewTokenDto,
} from '@gitroom/nestjs-libraries/dtos/social-control/social-approval.dto';
@Injectable()
export class SocialApprovalService {
  constructor(private readonly prisma: PrismaService) {}
  createPolicy(auth: ServiceAuthContext, input: SocialApprovalPolicyDto) {
    if (!input.stages.length)
      throw new BadRequestException('approval_stages_required');
    return this.prisma.socialApprovalPolicy.create({
      data: {
        tenantId: auth.tenantId,
        name: input.name,
        stages: input.stages as any,
      },
    });
  }
  async submit(
    auth: ServiceAuthContext,
    key: string | undefined,
    input: SocialApprovalRequestDto
  ) {
    if (!key || key.length < 16)
      throw new BadRequestException('valid_idempotency_key_required');
    const hash = this.hash(input);
    const replay = await this.prisma.socialApprovalRequest.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: auth.tenantId,
          idempotencyKey: key,
        },
      },
    });
    if (replay) {
      if (replay.payloadHash !== hash)
        throw new ConflictException('idempotency_payload_conflict');
      return replay;
    }
    const policy = await this.prisma.socialApprovalPolicy.findFirst({
      where: { id: input.policy_id, tenantId: auth.tenantId, active: true },
    });
    if (!policy) throw new NotFoundException('approval_policy_not_found');
    return this.prisma.socialApprovalRequest.create({
      data: {
        tenantId: auth.tenantId,
        policyId: policy.id,
        resourceType: input.resource_type,
        resourceId: input.resource_id,
        revisionId: input.revision_id,
        submittedBy: input.submitted_by,
        idempotencyKey: key,
        payloadHash: hash,
        correlationId: auth.correlationId,
      },
    });
  }
  async decide(
    auth: ServiceAuthContext,
    id: string,
    input: SocialApprovalDecisionDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.socialApprovalRequest.findFirst({
        where: { id, tenantId: auth.tenantId },
        include: { policy: true },
      });
      if (!request) throw new NotFoundException('approval_request_not_found');
      if (request.state !== 'PENDING')
        throw new ConflictException('approval_request_closed');
      if (input.actor === request.submittedBy)
        throw new ConflictException('approval_separation_of_duties');
      const stages = request.policy.stages as unknown[];
      const terminal =
        input.decision !== 'approve' ||
        request.currentStage + 1 >= stages.length;
      const state =
        input.decision === 'reject'
          ? 'REJECTED'
          : input.decision === 'request_changes'
          ? 'CHANGES_REQUESTED'
          : terminal
          ? 'APPROVED'
          : 'PENDING';
      await tx.socialApprovalDecision.create({
        data: {
          tenantId: auth.tenantId,
          requestId: id,
          stage: request.currentStage,
          actor: input.actor,
          decision: input.decision.toUpperCase() as any,
          comment: input.comment,
        },
      });
      return tx.socialApprovalRequest.update({
        where: { id },
        data: {
          state,
          currentStage:
            state === 'PENDING' ? { increment: 1 } : request.currentStage,
        },
      });
    });
  }
  async createReviewToken(
    auth: ServiceAuthContext,
    id: string,
    input: SocialExternalReviewTokenDto
  ) {
    const request = await this.prisma.socialApprovalRequest.findFirst({
      where: { id, tenantId: auth.tenantId, state: 'PENDING' },
    });
    if (!request) throw new NotFoundException('approval_request_not_found');
    const token = crypto.randomBytes(32).toString('base64url');
    await this.prisma.socialExternalReviewToken.create({
      data: {
        tenantId: auth.tenantId,
        requestId: id,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + input.expires_in_minutes * 60000),
        maxUses: input.max_uses,
        createdBy: input.created_by,
      },
    });
    return {
      review_token: token,
      review_url: `https://social.codestra.co/review/${token}`,
    };
  }
  private hash(value: unknown) {
    return crypto
      .createHash('sha256')
      .update(typeof value === 'string' ? value : JSON.stringify(value))
      .digest('hex');
  }
}
