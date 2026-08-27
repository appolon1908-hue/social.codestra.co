import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { OAuthRepository } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.repository';
import { CreateOAuthAppDto } from '@gitroom/nestjs-libraries/dtos/oauth/create-oauth-app.dto';
import { UpdateOAuthAppDto } from '@gitroom/nestjs-libraries/dtos/oauth/update-oauth-app.dto';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import {
  decryptSecret,
  encryptSecret,
  verificationHmac,
} from '@gitroom/helpers/security/envelope.crypto';
import crypto from 'node:crypto';

@Injectable()
export class OAuthService {
  constructor(private _oauthRepository: OAuthRepository) {}

  async getApp(orgId: string) {
    const app = await this._oauthRepository.getAppByOrgId(orgId);
    if (!app) return false;
    const {
      clientSecret,
      clientSecretCiphertext,
      clientSecretNonce,
      clientSecretKeyVersion,
      ...rest
    } = app;
    return rest;
  }

  async createApp(orgId: string, dto: CreateOAuthAppDto) {
    const existing = await this._oauthRepository.getAppByOrgId(orgId);
    if (existing) {
      throw new HttpException(
        'You can only have one OAuth application per organization',
        HttpStatus.BAD_REQUEST
      );
    }

    const clientId = 'pca_' + makeId(32);
    const clientSecret = 'pcs_' + makeId(48);
    const encryptedSecret = encryptSecret(
      clientSecret,
      `oauth-app:${orgId}:client-secret`
    );

    const app = await this._oauthRepository.createApp(orgId, {
      name: dto.name,
      description: dto.description,
      pictureId: dto.pictureId,
      redirectUrl: dto.redirectUrl,
      clientId,
      clientSecret: 'encrypted:v1',
      clientSecretCiphertext: encryptedSecret.ciphertext,
      clientSecretNonce: encryptedSecret.nonce,
      clientSecretKeyVersion: encryptedSecret.keyVersion,
    });

    return {
      id: app.id,
      name: app.name,
      description: app.description,
      pictureId: app.pictureId,
      redirectUrl: app.redirectUrl,
      clientId: app.clientId,
      createdAt: app.createdAt,
      clientSecret,
    };
  }

  async updateApp(orgId: string, dto: UpdateOAuthAppDto) {
    return this._oauthRepository.updateApp(orgId, {
      ...(dto.name && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.pictureId !== undefined && { pictureId: dto.pictureId }),
      ...(dto.redirectUrl && { redirectUrl: dto.redirectUrl }),
    });
  }

  async deleteApp(orgId: string) {
    const app = await this._oauthRepository.getAppByOrgId(orgId);
    if (!app) {
      throw new HttpException('No OAuth app found', HttpStatus.NOT_FOUND);
    }
    await this._oauthRepository.revokeAllForApp(app.id);
    await this._oauthRepository.deleteApp(orgId);
    return { success: true };
  }

  async rotateSecret(orgId: string) {
    const app = await this._oauthRepository.getAppByOrgId(orgId);
    if (!app) {
      throw new HttpException('No OAuth app found', HttpStatus.NOT_FOUND);
    }

    const newSecret = 'pcs_' + makeId(48);
    const encrypted = encryptSecret(
      newSecret,
      `oauth-app:${orgId}:client-secret`
    );
    await this._oauthRepository.updateClientSecret(orgId, encrypted);
    return { clientSecret: newSecret };
  }

  async validateAuthorizationRequest(clientId: string) {
    const app = await this._oauthRepository.getAppByClientId(clientId);
    if (!app) {
      throw new HttpException('Invalid client_id', HttpStatus.BAD_REQUEST);
    }
    return app;
  }

  async createAuthorizationCode(
    oauthAppId: string,
    userId: string,
    organizationId: string
  ) {
    const code = makeId(32);
    const encryptedCode = encryptSecret(
      code,
      `oauth-authorization:${oauthAppId}:code`
    );
    const codeHash = verificationHmac(
      code,
      'oauth-code-v1',
      'OAUTH_TOKEN_PEPPER'
    );
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this._oauthRepository.createAuthorization({
      oauthAppId,
      userId,
      organizationId,
      authorizationCode: encryptedCode.ciphertext,
      authorizationCodeHash: codeHash,
      codeExpiresAt,
    });

    return code;
  }

  async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret: string
  ) {
    const app = await this._oauthRepository.getAppByClientId(clientId);
    if (!app) {
      throw new HttpException(
        { error: 'invalid_client' },
        HttpStatus.UNAUTHORIZED
      );
    }

    if (
      !app.clientSecretCiphertext ||
      !app.clientSecretNonce ||
      !app.clientSecretKeyVersion
    ) {
      throw new HttpException(
        { error: 'invalid_client' },
        HttpStatus.UNAUTHORIZED
      );
    }
    const storedClientSecret = decryptSecret(
      {
        ciphertext: app.clientSecretCiphertext,
        nonce: app.clientSecretNonce,
        keyVersion: app.clientSecretKeyVersion,
        fingerprint: '',
      },
      `oauth-app:${app.organizationId}:client-secret`
    );
    if (
      storedClientSecret.length !== clientSecret.length ||
      !crypto.timingSafeEqual(
        Buffer.from(storedClientSecret),
        Buffer.from(clientSecret)
      )
    ) {
      throw new HttpException(
        { error: 'invalid_client' },
        HttpStatus.UNAUTHORIZED
      );
    }

    const codeHash = verificationHmac(
      code,
      'oauth-code-v1',
      'OAUTH_TOKEN_PEPPER'
    );
    const auth = await this._oauthRepository.findByCode(codeHash);
    if (!auth || auth.oauthAppId !== app.id) {
      throw new HttpException(
        { error: 'invalid_grant' },
        HttpStatus.BAD_REQUEST
      );
    }

    if (!auth.codeExpiresAt || new Date() > auth.codeExpiresAt) {
      throw new HttpException(
        { error: 'invalid_grant', error_description: 'Code has expired' },
        HttpStatus.BAD_REQUEST
      );
    }

    const token = 'pos_' + makeId(40);
    const encryptedToken = encryptSecret(
      token,
      `oauth-authorization:${auth.id}:access-token`
    );
    const tokenHash = verificationHmac(
      token,
      'oauth-access-token-v1',
      'OAUTH_TOKEN_PEPPER'
    );
    const {
      organizationId,
      organization: { paymentId },
    } = await this._oauthRepository.exchangeCodeForToken(
      auth.id,
      encryptedToken,
      tokenHash
    );

    return {
      id: organizationId,
      cus: paymentId,
      access_token: token,
      token_type: 'bearer',
    };
  }

  async getOrgByOAuthToken(token: string) {
    const tokenHash = verificationHmac(
      token,
      'oauth-access-token-v1',
      'OAUTH_TOKEN_PEPPER'
    );
    return this._oauthRepository.findByAccessToken(tokenHash);
  }

  async getApprovedApps(userId: string) {
    return this._oauthRepository.getApprovedApps(userId);
  }

  async revokeApp(userId: string, authId: string) {
    await this._oauthRepository.revokeAuthorization(userId, authId);
    return { success: true };
  }
}
