import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import {
  decryptSecret,
  encryptSecret,
} from '@gitroom/helpers/security/envelope.crypto';

@Injectable()
export class ThirdPartyRepository {
  constructor(private _thirdParty: PrismaRepository<'thirdParty'>) {}

  getAllThirdPartiesByOrganization(org: string) {
    return this._thirdParty.model.thirdParty.findMany({
      where: { organizationId: org, deletedAt: null },
      select: {
        id: true,
        name: true,
        identifier: true,
      },
    });
  }

  deleteIntegration(org: string, id: string) {
    return this._thirdParty.model.thirdParty.update({
      where: { id, organizationId: org },
      data: { deletedAt: new Date() },
    });
  }

  async getIntegrationById(org: string, id: string) {
    const integration = await this._thirdParty.model.thirdParty.findFirst({
      where: { id, organizationId: org, deletedAt: null },
    });
    if (!integration) return null;
    const apiKey =
      integration.apiKeyCiphertext &&
      integration.apiKeyNonce &&
      integration.apiKeyKeyVersion
        ? decryptSecret(
            {
              ciphertext: integration.apiKeyCiphertext,
              nonce: integration.apiKeyNonce,
              keyVersion: integration.apiKeyKeyVersion,
              fingerprint: '',
            },
            `third-party:${integration.organizationId}:${integration.internalId}:api-key`
          )
        : AuthService.fixedDecryption(integration.apiKey);
    return { ...integration, apiKey };
  }

  saveIntegration(
    org: string,
    identifier: string,
    apiKey: string,
    data: { name: string; username: string; id: string }
  ) {
    const encrypted = encryptSecret(
      apiKey,
      `third-party:${org}:${data.id}:api-key`
    );
    return this._thirdParty.model.thirdParty.upsert({
      where: {
        organizationId_internalId: {
          internalId: data.id,
          organizationId: org,
        },
      },
      create: {
        organizationId: org,
        name: data.name,
        internalId: data.id,
        identifier,
        apiKey: 'encrypted:v1',
        apiKeyCiphertext: encrypted.ciphertext,
        apiKeyNonce: encrypted.nonce,
        apiKeyKeyVersion: encrypted.keyVersion,
        deletedAt: null,
      },
      update: {
        organizationId: org,
        name: data.name,
        internalId: data.id,
        identifier,
        apiKey: 'encrypted:v1',
        apiKeyCiphertext: encrypted.ciphertext,
        apiKeyNonce: encrypted.nonce,
        apiKeyKeyVersion: encrypted.keyVersion,
        deletedAt: null,
      },
    });
  }
}
