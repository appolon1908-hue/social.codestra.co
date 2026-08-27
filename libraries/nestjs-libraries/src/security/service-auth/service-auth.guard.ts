import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SERVICE_SCOPES } from './service-auth.decorator';
import { ServiceAuthContext } from './service-auth.types';
import { ServiceTokenVerifier } from './service-token-verifier';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: ServiceTokenVerifier
  ) {}

  async canActivate(context: ExecutionContext) {
    if (process.env.SERVICE_AUTH_ENABLED !== 'true') {
      throw new ServiceUnavailableException('service_auth_disabled');
    }
    const request = context
      .switchToHttp()
      .getRequest<Request & { serviceAuth?: ServiceAuthContext }>();
    this.requireVerifiedMtls(request);

    const header = request.headers.authorization;
    const claims = await this.verifier.verifyAuthorizationHeader(header);
    const tenantId = this.singleHeader(request, 'x-tenant-id');
    if (!tenantId || tenantId !== claims.tenant_id) {
      throw new ForbiddenException('service_tenant_mismatch');
    }
    const correlationId = this.singleHeader(request, 'x-correlation-id');
    if (!correlationId || !UUID_PATTERN.test(correlationId)) {
      throw new ForbiddenException('valid_correlation_id_required');
    }

    const scopes = (claims.scope || '').split(/\s+/).filter(Boolean);
    const required =
      this.reflector.getAllAndOverride<string[]>(SERVICE_SCOPES, [
        context.getHandler(),
        context.getClass(),
      ]) || [];
    if (required.some((scope) => !scopes.includes(scope))) {
      throw new ForbiddenException('service_scope_missing');
    }

    request.serviceAuth = {
      subject: claims.sub,
      clientId: claims.azp || claims.client_id || claims.sub,
      tenantId,
      scopes,
      correlationId,
      claims,
    };
    return true;
  }

  private requireVerifiedMtls(request: Request) {
    if (process.env.SERVICE_MTLS_REQUIRED !== 'true') return;
    const headerName = (
      process.env.SERVICE_MTLS_VERIFIED_HEADER || 'x-client-cert-verified'
    ).toLowerCase();
    const expected = process.env.SERVICE_MTLS_VERIFIED_VALUE || 'SUCCESS';
    if (this.singleHeader(request, headerName) !== expected) {
      throw new UnauthorizedException('verified_mtls_required');
    }
  }

  private singleHeader(request: Request, name: string) {
    const value = request.headers[name.toLowerCase()];
    return Array.isArray(value) ? undefined : value?.trim();
  }
}
