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

@ApiTags('Codestra Social private control plane')
@Controller('/internal/v1/social')
@UseGuards(ServiceAuthGuard)
export class InternalSocialController {
  constructor(private readonly social: SocialControlService) {}

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
