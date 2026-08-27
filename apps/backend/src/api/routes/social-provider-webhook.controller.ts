import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SocialProviderEventDto } from '@gitroom/nestjs-libraries/dtos/social-control/social-provider-event.dto';
import { SocialProviderEventsService } from '@gitroom/nestjs-libraries/database/prisma/social-control/social-provider-events.service';

@ApiTags('Codestra Social product-local provider callbacks')
@Controller('/internal/v1/social/provider-events')
export class SocialProviderWebhookController {
  constructor(private readonly events: SocialProviderEventsService) {}

  @Post('/:provider')
  receive(
    @Param('provider') provider: string,
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Headers('x-codestra-timestamp') timestamp: string | undefined,
    @Headers('x-codestra-signature') signature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
    @Body() body: SocialProviderEventDto
  ) {
    return this.events.receive({
      tenantId,
      provider,
      correlationId,
      timestamp,
      signature,
      rawBody: request.rawBody,
      body,
    });
  }
}
