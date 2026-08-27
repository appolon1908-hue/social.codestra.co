import { Body, Controller, Delete, Get, Post, Put, Req } from '@nestjs/common';
import { Request } from 'express';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization, User } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { OAuthService } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { CreateOAuthAppDto } from '@gitroom/nestjs-libraries/dtos/oauth/create-oauth-app.dto';
import { UpdateOAuthAppDto } from '@gitroom/nestjs-libraries/dtos/oauth/update-oauth-app.dto';
import { SessionService } from '@gitroom/nestjs-libraries/security/session.service';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

@ApiTags('OAuth App')
@Controller('/user/oauth-app')
export class OAuthAppController {
  constructor(
    private _oauthService: OAuthService,
    private readonly sessions: SessionService
  ) {}

  private async requireRecentAuth(req: Request, userId: string) {
    const access = (req.headers.auth as string) || req.cookies?.auth;
    const payload = AuthService.verifyJWT(access) as { sessionId: string };
    await this.sessions.requireRecentAuthentication(payload.sessionId, userId);
  }

  @Get('/')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async getApp(@GetOrgFromRequest() org: Organization) {
    return this._oauthService.getApp(org.id);
  }

  @Post('/')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async createApp(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Req() req: Request,
    @Body() body: CreateOAuthAppDto
  ) {
    await this.requireRecentAuth(req, user.id);
    return this._oauthService.createApp(org.id, body);
  }

  @Put('/')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async updateApp(
    @GetOrgFromRequest() org: Organization,
    @Body() body: UpdateOAuthAppDto
  ) {
    return this._oauthService.updateApp(org.id, body);
  }

  @Delete('/')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async deleteApp(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Req() req: Request
  ) {
    await this.requireRecentAuth(req, user.id);
    return this._oauthService.deleteApp(org.id);
  }

  @Post('/rotate-secret')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async rotateSecret(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Req() req: Request
  ) {
    await this.requireRecentAuth(req, user.id);
    return this._oauthService.rotateSecret(org.id);
  }
}
