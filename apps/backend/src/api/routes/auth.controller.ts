import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Response, Request } from 'express';

import { CreateOrgUserDto } from '@gitroom/nestjs-libraries/dtos/auth/create.org.user.dto';
import { LoginUserDto } from '@gitroom/nestjs-libraries/dtos/auth/login.user.dto';
import { AuthService } from '@gitroom/backend/services/auth/auth.service';
import { ForgotReturnPasswordDto } from '@gitroom/nestjs-libraries/dtos/auth/forgot-return.password.dto';
import { ForgotPasswordDto } from '@gitroom/nestjs-libraries/dtos/auth/forgot.password.dto';
import { ResendActivationDto } from '@gitroom/nestjs-libraries/dtos/auth/resend-activation.dto';
import { ApiTags } from '@nestjs/swagger';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import { EmailService } from '@gitroom/nestjs-libraries/services/email.service';
import { RealIP } from 'nestjs-real-ip';
import { UserAgent } from '@gitroom/nestjs-libraries/user/user.agent';
import { Provider } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import { SessionService } from '@gitroom/nestjs-libraries/security/session.service';
import { issueCsrfCookie } from '@gitroom/backend/services/auth/csrf.middleware';
import { AuthService as AuthChecker } from '@gitroom/helpers/auth/auth.service';

@ApiTags('Auth')
@Controller('/auth')
export class AuthController {
  constructor(
    private _authService: AuthService,
    private _emailService: EmailService,
    private _sessionService: SessionService
  ) {}

  @Get('/can-register')
  async canRegister() {
    return {
      register: await this._authService.canRegister(Provider.LOCAL as string),
    };
  }

  @Post('/register')
  async register(
    @Req() req: Request,
    @Body() body: CreateOrgUserDto,
    @Res({ passthrough: false }) response: Response,
    @RealIP() ip: string,
    @UserAgent() userAgent: string
  ) {
    try {
      const getOrgFromCookie = this._authService.getOrgFromCookie(
        req?.cookies?.org
      );

      const { jwt, refreshToken, refreshExpiresAt, addedOrg } =
        await this._authService.routeAuth(
          body.provider,
          body,
          ip,
          userAgent,
          getOrgFromCookie
        );

      const activationRequired =
        body.provider === 'LOCAL' && this._emailService.hasProvider();

      if (activationRequired) {
        const pending = AuthChecker.verifyJWT(jwt) as {
          id: string;
          sessionId: string;
        };
        await this._sessionService.revoke(
          pending.sessionId,
          pending.id,
          'activation_pending'
        );
        response.header('activate', 'true');
        response.status(200).json({ activate: true });
        return;
      }

      response.cookie('auth', jwt, {
        domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
        ...(!process.env.NOT_SECURED
          ? {
              secure: true,
              httpOnly: true,
              sameSite: 'lax',
            }
          : {}),
        maxAge: 15 * 60 * 1000,
      });
      this.setRefreshCookie(response, refreshToken, refreshExpiresAt);
      issueCsrfCookie(response);

      if (process.env.NOT_SECURED) {
        response.header('auth', jwt);
      }

      if (typeof addedOrg !== 'boolean' && addedOrg?.organizationId) {
        response.cookie('showorg', addedOrg.organizationId, {
          domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
          ...(!process.env.NOT_SECURED
            ? {
                secure: true,
                httpOnly: true,
                sameSite: 'lax',
              }
            : {}),
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        });

        if (process.env.NOT_SECURED) {
          response.header('showorg', addedOrg.organizationId);
        }
      }

      Sentry.metrics.count('new_user', 1);
      response.header('onboarding', 'true');
      response.status(200).json({
        register: true,
      });
    } catch {
      response.status(400).json({ error: 'registration_failed' });
    }
  }

  @Post('/login')
  async login(
    @Req() req: Request,
    @Body() body: LoginUserDto,
    @Res({ passthrough: false }) response: Response,
    @RealIP() ip: string,
    @UserAgent() userAgent: string
  ) {
    try {
      const getOrgFromCookie = this._authService.getOrgFromCookie(
        req?.cookies?.org
      );

      const { jwt, refreshToken, refreshExpiresAt, addedOrg } =
        await this._authService.routeAuth(
          body.provider,
          body,
          ip,
          userAgent,
          getOrgFromCookie
        );

      response.cookie('auth', jwt, {
        domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
        ...(!process.env.NOT_SECURED
          ? {
              secure: true,
              httpOnly: true,
              sameSite: 'lax',
            }
          : {}),
        maxAge: 15 * 60 * 1000,
      });
      this.setRefreshCookie(response, refreshToken, refreshExpiresAt);
      issueCsrfCookie(response);

      if (process.env.NOT_SECURED) {
        response.header('auth', jwt);
      }

      if (typeof addedOrg !== 'boolean' && addedOrg?.organizationId) {
        response.cookie('showorg', addedOrg.organizationId, {
          domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
          ...(!process.env.NOT_SECURED
            ? {
                secure: true,
                httpOnly: true,
                sameSite: 'lax',
              }
            : {}),
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        });

        if (process.env.NOT_SECURED) {
          response.header('showorg', addedOrg.organizationId);
        }
      }

      response.header('reload', 'true');
      response.status(200).json({
        login: true,
      });
    } catch {
      response.status(401).json({ error: 'authentication_failed' });
    }
  }

  @Post('/refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: false }) response: Response
  ) {
    try {
      const session = await this._sessionService.rotate(
        req.cookies?.refresh || ''
      );
      response.cookie('auth', session.accessToken, {
        domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
        secure: !process.env.NOT_SECURED,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });
      this.setRefreshCookie(
        response,
        session.refreshToken,
        session.refreshExpiresAt
      );
      issueCsrfCookie(response);
      return response.status(200).json({ refreshed: true });
    } catch {
      return response.status(401).json({ error: 'invalid_session' });
    }
  }

  @Post('/forgot')
  async forgot(@Body() body: ForgotPasswordDto) {
    if (!this._emailService.hasProvider()) {
      return { forgot: false, error: 'email_provider_not_configured' };
    }
    await this._authService.forgot(body.email).catch(() => undefined);
    return { forgot: true };
  }

  @Post('/forgot-return')
  async forgotReturn(@Body() body: ForgotReturnPasswordDto) {
    const reset = await this._authService.forgotReturn(body);
    return {
      reset: !!reset,
    };
  }

  @Get('/oauth-mobile-callback')
  mobileCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res({ passthrough: false }) response: Response
  ) {
    const scheme = process.env.MOBILE_APP_SCHEME || 'postiz://auth/callback';
    const params = new URLSearchParams();
    if (code) params.set('code', code);
    if (state) params.set('state', state);
    return response.redirect(302, `${scheme}?${params.toString()}`);
  }

  @Get('/oauth/:provider')
  async oauthLink(@Param('provider') provider: string, @Query() query: any) {
    return this._authService.oauthLink(provider, query);
  }

  @Post('/activate')
  async activate(
    @Body('code') code: string,
    @Body('datafast_visitor_id') datafast_visitor_id: string,
    @Res({ passthrough: false }) response: Response,
    @RealIP() ip: string,
    @UserAgent() userAgent: string
  ) {
    const activate = await this._authService.activate(
      code,
      datafast_visitor_id,
      ip,
      userAgent
    );
    if (!activate) {
      return response.status(200).json({ can: false });
    }

    response.cookie('auth', activate.accessToken, {
      domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
      ...(!process.env.NOT_SECURED
        ? {
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
          }
        : {}),
      maxAge: 15 * 60 * 1000,
    });
    this.setRefreshCookie(
      response,
      activate.refreshToken,
      activate.refreshExpiresAt
    );
    issueCsrfCookie(response);

    if (process.env.NOT_SECURED) {
      response.header('auth', activate.accessToken);
    }

    response.header('onboarding', 'true');

    return response.status(200).json({ can: true });
  }

  @Post('/resend-activation')
  async resendActivation(@Body() body: ResendActivationDto) {
    if (!this._emailService.hasProvider()) {
      return { success: false, error: 'email_provider_not_configured' };
    }
    await this._authService
      .resendActivationEmail(body.email)
      .catch(() => undefined);
    return { success: true };
  }

  @Post('/oauth/:provider/exists')
  async oauthExists(
    @Body('code') code: string,
    @Body('redirect_uri') redirect_uri: string,
    @Param('provider') provider: string,
    @Res({ passthrough: false }) response: Response,
    @RealIP() ip: string,
    @UserAgent() userAgent: string
  ) {
    const result = await this._authService.checkExists(
      provider,
      code,
      redirect_uri,
      ip,
      userAgent
    );

    if ('token' in result && result.token) {
      return response.json({ token: result.token });
    }

    const { jwt, refreshToken, refreshExpiresAt } = result as {
      jwt: string;
      refreshToken: string;
      refreshExpiresAt: Date;
    };

    response.cookie('auth', jwt, {
      domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
      ...(!process.env.NOT_SECURED
        ? {
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
          }
        : {}),
      maxAge: 15 * 60 * 1000,
    });
    this.setRefreshCookie(response, refreshToken!, refreshExpiresAt!);
    issueCsrfCookie(response);

    if (process.env.NOT_SECURED) {
      response.header('auth', jwt);
    }

    response.header('reload', 'true');

    response.status(200).json({
      login: true,
    });
  }

  private setRefreshCookie(response: Response, token: string, expiresAt: Date) {
    response.cookie('refresh', token, {
      domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
      path: '/api/auth',
      secure: !process.env.NOT_SECURED,
      httpOnly: true,
      sameSite: 'lax',
      expires: expiresAt,
    });
  }
}
