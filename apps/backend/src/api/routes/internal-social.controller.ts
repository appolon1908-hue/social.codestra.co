import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SocialPublicationCommandDto } from '@gitroom/nestjs-libraries/dtos/social-control/social-publication-command.dto';
import { SocialControlService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-control.service';
import { ServiceAuthGuard } from '@gitroom/nestjs-libraries/security/service-auth/service-auth.guard';
import {
  GetServiceAuth,
  RequireServiceScopes,
} from '@gitroom/nestjs-libraries/security/service-auth/service-auth.decorator';
import { ServiceAuthContext } from '@gitroom/nestjs-libraries/security/service-auth/service-auth.types';
import { SocialOnboardingService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-onboarding.service';
import { SocialOnboardingTransitionDto } from '@gitroom/nestjs-libraries/dtos/social-control/social-onboarding.dto';
import { SocialBillingService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-billing.service';
import { SocialBillingEventDto } from '@gitroom/nestjs-libraries/dtos/social-control/social-billing-event.dto';
import { SocialBrandService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-brand.service';
import {
  SocialAiGenerationRequestDto,
  SocialBrandCreateDto,
} from '@gitroom/nestjs-libraries/dtos/social-control/social-brand.dto';
import { SocialApprovalService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-approval.service';
import {
  SocialApprovalDecisionDto,
  SocialApprovalPolicyDto,
  SocialApprovalRequestDto,
  SocialExternalReviewTokenDto,
} from '@gitroom/nestjs-libraries/dtos/social-control/social-approval.dto';

@ApiTags('Codestra Social private control plane')
@Controller('/internal/v1/social')
@UseGuards(ServiceAuthGuard)
export class InternalSocialController {
  constructor(
    private readonly social: SocialControlService,
    private readonly onboarding: SocialOnboardingService,
    private readonly billing: SocialBillingService,
    private readonly brands: SocialBrandService,
    private readonly approvals: SocialApprovalService
  ) {}

  @Post('/approval-policies')
  @RequireServiceScopes('social.approvals.write')
  createApprovalPolicy(
    @GetServiceAuth() auth: ServiceAuthContext,
    @Body() body: SocialApprovalPolicyDto
  ) {
    return this.approvals.createPolicy(auth, body);
  }

  @Post('/approvals')
  @RequireServiceScopes('social.approvals.write')
  submitApproval(
    @GetServiceAuth() auth: ServiceAuthContext,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: SocialApprovalRequestDto
  ) {
    return this.approvals.submit(auth, key, body);
  }

  @Post('/approvals/:approvalId/decisions')
  @RequireServiceScopes('social.approvals.decide')
  decideApproval(
    @GetServiceAuth() auth: ServiceAuthContext,
    @Param('approvalId') id: string,
    @Body() body: SocialApprovalDecisionDto
  ) {
    return this.approvals.decide(auth, id, body);
  }

  @Post('/approvals/:approvalId/review-tokens')
  @RequireServiceScopes('social.approvals.share')
  createReviewToken(
    @GetServiceAuth() auth: ServiceAuthContext,
    @Param('approvalId') id: string,
    @Body() body: SocialExternalReviewTokenDto
  ) {
    return this.approvals.createReviewToken(auth, id, body);
  }

  @Get('/onboarding')
  @RequireServiceScopes('social.onboarding.read')
  getOnboarding(@GetServiceAuth() auth: ServiceAuthContext) {
    return this.onboarding.get(auth);
  }

  @Post('/brands')
  @RequireServiceScopes('social.brands.write')
  createBrand(
    @GetServiceAuth() auth: ServiceAuthContext,
    @Body() body: SocialBrandCreateDto
  ) {
    return this.brands.createBrand(auth, body);
  }

  @Get('/brands/:brandId')
  @RequireServiceScopes('social.brands.read')
  getBrand(
    @GetServiceAuth() auth: ServiceAuthContext,
    @Param('brandId') brandId: string
  ) {
    return this.brands.getBrand(auth, brandId);
  }

  @Post('/brain/generations')
  @RequireServiceScopes('social.ai.generate')
  generate(
    @GetServiceAuth() auth: ServiceAuthContext,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: SocialAiGenerationRequestDto
  ) {
    return this.brands.requestGeneration(auth, key, body);
  }

  @Post('/billing/events')
  @RequireServiceScopes('social.billing.events.write')
  acceptBillingEvent(
    @GetServiceAuth() auth: ServiceAuthContext,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: SocialBillingEventDto
  ) {
    return this.billing.accept(auth, idempotencyKey, body);
  }

  @Post('/onboarding/transitions')
  @RequireServiceScopes('social.onboarding.write')
  advanceOnboarding(
    @GetServiceAuth() auth: ServiceAuthContext,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: SocialOnboardingTransitionDto
  ) {
    return this.onboarding.advance(auth, idempotencyKey, body);
  }

  @Post('/commands/publish')
  @RequireServiceScopes('social.commands.write')
  publish(
    @GetServiceAuth() auth: ServiceAuthContext,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: SocialPublicationCommandDto
  ) {
    return this.social.acceptPublication(auth, idempotencyKey, body);
  }

  @Get('/commands/:commandId')
  @RequireServiceScopes('social.commands.read')
  command(
    @GetServiceAuth() auth: ServiceAuthContext,
    @Param('commandId') commandId: string
  ) {
    return this.social.command(auth, commandId);
  }

  @Get('/deliveries/:deliveryId')
  @RequireServiceScopes('social.deliveries.read')
  delivery(
    @GetServiceAuth() auth: ServiceAuthContext,
    @Param('deliveryId') deliveryId: string
  ) {
    return this.social.delivery(auth, deliveryId);
  }
}
