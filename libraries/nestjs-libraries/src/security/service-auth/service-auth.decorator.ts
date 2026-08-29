import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { ServiceAuthContext } from './service-auth.types';

export const SERVICE_SCOPES = 'codestra:service-scopes';

export const RequireServiceScopes = (...scopes: string[]) =>
  SetMetadata(SERVICE_SCOPES, scopes);

export const GetServiceAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ServiceAuthContext =>
    context.switchToHttp().getRequest().serviceAuth
);
