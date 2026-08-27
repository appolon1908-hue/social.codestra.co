import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import {
  safeFingerprint,
  secretHmac,
} from '@gitroom/helpers/security/envelope.crypto';

const REFRESH_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(token: string) {
    return secretHmac(
      token,
      'codestra-refresh-token-v1',
      'SESSION_TOKEN_PEPPER'
    );
  }

  private accessToken(
    user: { id: string; securityVersion: number },
    organizationId: string,
    sessionId: string
  ) {
    return AuthService.signJWT({
      sub: user.id,
      id: user.id,
      organizationId,
      sessionId,
      securityVersion: user.securityVersion,
    });
  }

  async create(
    userId: string,
    organizationId: string,
    ip: string,
    userAgent: string
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const now = new Date();
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        organizationId,
        tokenFamilyId: crypto.randomUUID(),
        refreshTokenHash: this.hash(refreshToken),
        expiresAt: new Date(now.getTime() + REFRESH_LIFETIME_MS),
        deviceLabel: userAgent.slice(0, 120),
        ipFingerprint: safeFingerprint(ip),
        userAgentFingerprint: safeFingerprint(userAgent),
      },
    });
    return {
      accessToken: this.accessToken(user, organizationId, session.id),
      refreshToken,
      refreshExpiresAt: session.expiresAt,
    };
  }

  async rotate(refreshToken: string) {
    const tokenHash = this.hash(refreshToken);
    const current = await this.prisma.authSession.findFirst({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });
    if (!current) {
      const reused = await this.prisma.authRefreshTokenHistory.findUnique({
        where: { tokenHash },
        include: { session: true },
      });
      if (reused) {
        await this.prisma.authSession.updateMany({
          where: {
            tokenFamilyId: reused.session.tokenFamilyId,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
            revocationReason: 'refresh_token_reuse',
          },
        });
        throw new Error('Refresh token reuse detected');
      }
      throw new Error('Invalid refresh session');
    }
    if (current.revokedAt || current.expiresAt <= new Date()) {
      throw new Error('Invalid refresh session');
    }

    const replacement = crypto.randomBytes(48).toString('base64url');
    const replacementHash = this.hash(replacement);
    try {
      await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.authSession.updateMany({
          where: {
            id: current.id,
            refreshTokenHash: tokenHash,
            revokedAt: null,
          },
          data: {
            previousTokenHash: current.refreshTokenHash,
            refreshTokenHash: replacementHash,
            lastUsedAt: new Date(),
          },
        });
        if (updated.count !== 1) throw new Error('refresh_token_race');
        await transaction.authRefreshTokenHistory.create({
          data: { sessionId: current.id, tokenHash },
        });
      });
    } catch {
      await this.prisma.authSession.updateMany({
        where: { tokenFamilyId: current.tokenFamilyId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revocationReason: 'refresh_token_reuse',
        },
      });
      throw new Error('Refresh token reuse detected');
    }
    const expiresAt = current.expiresAt;
    return {
      accessToken: this.accessToken(
        current.user,
        current.organizationId,
        current.id
      ),
      refreshToken: replacement,
      refreshExpiresAt: expiresAt,
    };
  }

  async validateAccess(
    userId: string,
    sessionId: string,
    securityVersion: number
  ) {
    return this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { securityVersion },
      },
    });
  }

  revoke(sessionId: string, userId: string, reason = 'logout') {
    return this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: reason },
    });
  }

  async revokeAll(
    userId: string,
    reason = 'owner_revoke_all',
    incrementSecurityVersion = true
  ) {
    if (!incrementSecurityVersion) {
      return this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: reason },
      });
    }
    return this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: reason },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { securityVersion: { increment: 1 } },
      }),
    ]);
  }

  list(userId: string) {
    return this.prisma.authSession.findMany({
      where: { userId },
      select: {
        id: true,
        organizationId: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        revocationReason: true,
        deviceLabel: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRecentAuthentication(sessionId: string, userId: string) {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { recentAuthAt: new Date() },
    });
  }

  async requireRecentAuthentication(sessionId: string, userId: string) {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        recentAuthAt: { gte: cutoff },
      },
      select: { id: true },
    });
    if (!session) throw new Error('recent_authentication_required');
  }
}
