import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Injectable()
export class OAuthRepository {
  constructor(
    private _oauthApp: PrismaRepository<'oAuthApp'>,
    private _oauthAuth: PrismaRepository<'oAuthAuthorization'>
  ) {}

  getAppByOrgId(orgId: string) {
    return this._oauthApp.model.oAuthApp.findFirst({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        picture: true,
      },
    });
  }

  getAppByClientId(clientId: string) {
    return this._oauthApp.model.oAuthApp.findFirst({
      where: {
        clientId,
        deletedAt: null,
      },
      include: {
        picture: true,
      },
    });
  }

  createApp(
    orgId: string,
    data: {
      name: string;
      description?: string;
      pictureId?: string;
      redirectUrl: string;
      clientId: string;
      clientSecret: string;
      clientSecretCiphertext: string;
      clientSecretNonce: string;
      clientSecretKeyVersion: number;
    }
  ) {
    return this._oauthApp.model.oAuthApp.create({
      data: {
        organizationId: orgId,
        name: data.name,
        description: data.description,
        pictureId: data.pictureId,
        redirectUrl: data.redirectUrl,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        clientSecretCiphertext: data.clientSecretCiphertext,
        clientSecretNonce: data.clientSecretNonce,
        clientSecretKeyVersion: data.clientSecretKeyVersion,
      },
      include: {
        picture: true,
      },
    });
  }

  async updateApp(
    orgId: string,
    data: {
      name?: string;
      description?: string;
      pictureId?: string;
      redirectUrl?: string;
    }
  ) {
    const app = await this._oauthApp.model.oAuthApp.findFirst({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
    });
    if (!app) {
      return null;
    }
    return this._oauthApp.model.oAuthApp.update({
      where: { id: app.id },
      data,
      include: {
        picture: true,
      },
    });
  }

  async deleteApp(orgId: string) {
    const app = await this._oauthApp.model.oAuthApp.findFirst({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
    });
    if (!app) {
      return null;
    }
    return this._oauthApp.model.oAuthApp.update({
      where: { id: app.id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async updateClientSecret(
    orgId: string,
    encrypted: { ciphertext: string; nonce: string; keyVersion: number }
  ) {
    const app = await this._oauthApp.model.oAuthApp.findFirst({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
    });
    if (!app) {
      return null;
    }
    return this._oauthApp.model.oAuthApp.update({
      where: { id: app.id },
      data: {
        clientSecret: 'encrypted:v1',
        clientSecretCiphertext: encrypted.ciphertext,
        clientSecretNonce: encrypted.nonce,
        clientSecretKeyVersion: encrypted.keyVersion,
      },
    });
  }

  createAuthorization(data: {
    oauthAppId: string;
    userId: string;
    organizationId: string;
    authorizationCode: string;
    authorizationCodeHash: string;
    codeExpiresAt: Date;
  }) {
    return this._oauthAuth.model.oAuthAuthorization.upsert({
      where: {
        oauthAppId_userId_organizationId: {
          oauthAppId: data.oauthAppId,
          userId: data.userId,
          organizationId: data.organizationId,
        },
      },
      create: {
        oauthAppId: data.oauthAppId,
        userId: data.userId,
        organizationId: data.organizationId,
        authorizationCode: data.authorizationCode,
        authorizationCodeHash: data.authorizationCodeHash,
        codeExpiresAt: data.codeExpiresAt,
      },
      update: {
        authorizationCode: data.authorizationCode,
        authorizationCodeHash: data.authorizationCodeHash,
        codeExpiresAt: data.codeExpiresAt,
        accessToken: null,
        revokedAt: null,
      },
    });
  }

  findByCode(codeHash: string) {
    return this._oauthAuth.model.oAuthAuthorization.findFirst({
      where: {
        authorizationCodeHash: codeHash,
        revokedAt: null,
      },
    });
  }

  exchangeCodeForToken(
    id: string,
    encryptedToken: { ciphertext: string; nonce: string; keyVersion: number },
    tokenHash: string
  ) {
    return this._oauthAuth.model.oAuthAuthorization.update({
      where: { id },
      select: {
        organizationId: true,
        organization: {
          select: {
            paymentId: true,
          },
        },
      },
      data: {
        accessToken: 'encrypted:v1',
        accessTokenHash: tokenHash,
        accessTokenCiphertext: encryptedToken.ciphertext,
        accessTokenNonce: encryptedToken.nonce,
        accessTokenKeyVersion: encryptedToken.keyVersion,
        authorizationCode: null,
        authorizationCodeHash: null,
        codeExpiresAt: null,
      },
    });
  }

  findByAccessToken(tokenHash: string) {
    return this._oauthAuth.model.oAuthAuthorization.findFirst({
      where: {
        accessTokenHash: tokenHash,
        revokedAt: null,
      },
      include: {
        organization: {
          include: {
            subscription: {
              select: {
                subscriptionTier: true,
                totalChannels: true,
                isLifetime: true,
              },
            },
          },
        },
        user: {
          select: { id: true },
        },
      },
    });
  }

  getApprovedApps(userId: string) {
    return this._oauthAuth.model.oAuthAuthorization.findMany({
      where: {
        userId,
        revokedAt: null,
        accessToken: { not: null },
      },
      include: {
        oauthApp: {
          include: {
            picture: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  revokeAuthorization(userId: string, authId: string) {
    return this._oauthAuth.model.oAuthAuthorization.update({
      where: {
        id: authId,
        userId,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  revokeAllForApp(oauthAppId: string) {
    return this._oauthAuth.model.oAuthAuthorization.updateMany({
      where: {
        oauthAppId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
