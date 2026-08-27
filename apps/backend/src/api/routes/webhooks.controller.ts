import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import {
  SecureWebhookSubscriptionDto,
  WebhookEnabledDto,
} from '@gitroom/nestjs-libraries/dtos/webhooks/webhooks.dto';
import { SecureWebhooksService } from '@gitroom/nestjs-libraries/security/secure-webhooks.service';
import { SessionService } from '@gitroom/nestjs-libraries/security/session.service';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

@ApiTags('Codestra Webhooks')
@Controller('/webhooks')
export class WebhookController {
  constructor(
    private readonly webhooks: SecureWebhooksService,
    private readonly sessions: SessionService
  ) {}

  private async requireRecentAuth(req: Request, userId: string) {
    const access = (req.headers.auth as string) || req.cookies?.auth;
    const payload = AuthService.verifyJWT(access) as { sessionId: string };
    await this.sessions.requireRecentAuthentication(payload.sessionId, userId);
  }

  @Get('/')
  list(@GetOrgFromRequest() organization: Organization) {
    return this.webhooks.listSubscriptions(organization.id);
  }

  @Post('/')
  @CheckPolicies([AuthorizationActions.Create, Sections.WEBHOOKS])
  create(
    @GetOrgFromRequest() organization: Organization,
    @GetUserFromRequest() user: User,
    @Req() req: Request,
    @Body() body: SecureWebhookSubscriptionDto
  ) {
    return this.requireRecentAuth(req, user.id).then(() =>
      this.webhooks.createSubscription(organization.id, body)
    );
  }

  @Put('/:id')
  @CheckPolicies([AuthorizationActions.Create, Sections.WEBHOOKS])
  update(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string,
    @Body() body: SecureWebhookSubscriptionDto
  ) {
    return this.webhooks.updateSubscription(organization.id, id, body);
  }

  @Post('/:id/enabled')
  @CheckPolicies([AuthorizationActions.Create, Sections.WEBHOOKS])
  setEnabled(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string,
    @Body() body: WebhookEnabledDto
  ) {
    return this.webhooks.setEnabled(organization.id, id, body.enabled);
  }

  @Get('/:id/deliveries')
  history(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string
  ) {
    return this.webhooks.deliveryHistory(organization.id, id);
  }

  @Post('/:id/test')
  @CheckPolicies([AuthorizationActions.Create, Sections.WEBHOOKS])
  async test(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string
  ) {
    if (process.env.WEBHOOK_DELIVERY_ENABLED !== 'true') {
      return { accepted: false, error: 'webhook_delivery_disabled' };
    }
    return this.webhooks.enqueueForSubscription(
      organization.id,
      id,
      'webhook.test',
      {
        subscription_id: id,
        message: 'Codestra webhook verification',
      }
    );
  }

  @Post('/dead-letters/:id/replay')
  @CheckPolicies([AuthorizationActions.Create, Sections.WEBHOOKS])
  async replay(
    @GetOrgFromRequest() organization: Organization,
    @GetUserFromRequest() user: User,
    @Req() req: Request,
    @Param('id') id: string,
    @Body('reason') reason: string
  ) {
    await this.requireRecentAuth(req, user.id);
    if (!reason || reason.trim().length < 8) {
      throw new Error('replay_reason_required');
    }
    return this.webhooks.replayDeadLetter(
      organization.id,
      id,
      user.id,
      reason.trim()
    );
  }

  @Delete('/:id')
  @CheckPolicies([AuthorizationActions.Create, Sections.WEBHOOKS])
  remove(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string
  ) {
    return this.webhooks.deleteSubscription(organization.id, id);
  }
}
