import { Module } from '@nestjs/common';
import { ServiceAuthGuard } from './service-auth.guard';
import { ServiceTokenVerifier } from './service-token-verifier';

@Module({
  providers: [ServiceTokenVerifier, ServiceAuthGuard],
  exports: [ServiceTokenVerifier, ServiceAuthGuard],
})
export class ServiceAuthModule {}
