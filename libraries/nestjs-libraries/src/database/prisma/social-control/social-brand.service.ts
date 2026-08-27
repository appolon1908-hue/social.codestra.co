import crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceAuthContext } from '@gitroom/nestjs-libraries/security/service-auth/service-auth.types';
import {
  SocialAiGenerationRequestDto,
  SocialBrandCreateDto,
} from '@gitroom/nestjs-libraries/dtos/social-control/social-brand.dto';
import { SocialBrandRepository } from './social-brand.repository';

@Injectable()
export class SocialBrandService {
  constructor(private readonly repository: SocialBrandRepository) {}

  createBrand(auth: ServiceAuthContext, input: SocialBrandCreateDto) {
    return this.repository.createBrand(auth.tenantId, input);
  }

  async getBrand(auth: ServiceAuthContext, id: string) {
    const brand = await this.repository.brand(auth.tenantId, id);
    if (!brand) throw new NotFoundException('social_brand_not_found');
    return brand;
  }

  async requestGeneration(
    auth: ServiceAuthContext,
    key: string | undefined,
    input: SocialAiGenerationRequestDto
  ) {
    if (!key || key.length < 16 || key.length > 200)
      throw new BadRequestException('valid_idempotency_key_required');
    const hash = this.hash(input);
    const existing = await this.repository.generationByIdempotency(
      auth.tenantId,
      key
    );
    if (existing) {
      if (existing.payloadHash !== hash)
        throw new ConflictException('idempotency_payload_conflict');
      return this.response(existing, true);
    }
    const revision = await this.repository.revision(
      auth.tenantId,
      input.brand_revision_id
    );
    if (!revision)
      throw new NotFoundException('social_brand_revision_not_found');
    const findings = [
      ...revision.prohibitedTopics,
      ...revision.prohibitedClaims,
    ]
      .filter((term) => input.prompt.toLowerCase().includes(term.toLowerCase()))
      .map((term) => `prohibited:${term}`);
    const score = Math.min(100, findings.length * 50);
    const enabled = process.env.SOCIAL_AI_GENERATION_ENABLED === 'true';
    const state = !enabled
      ? 'BLOCKED'
      : findings.length
      ? 'REVIEW_REQUIRED'
      : 'REQUESTED';
    const generation = await this.repository.createGeneration({
      tenantId: auth.tenantId,
      correlationId: auth.correlationId,
      idempotencyKey: key,
      payloadHash: hash,
      request: input,
      riskScore: score,
      findings,
      state,
    });
    return this.response(generation, false);
  }

  private response(
    value: {
      id: string;
      state: string;
      riskScore: number;
      riskFindings: unknown;
    },
    replayed: boolean
  ) {
    return {
      generation_id: value.id,
      state: value.state.toLowerCase(),
      risk_score: value.riskScore,
      risk_findings: value.riskFindings,
      idempotency_replayed: replayed,
      automatic_publish: false,
    };
  }
  private hash(value: unknown) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(value))
      .digest('hex');
  }
}
