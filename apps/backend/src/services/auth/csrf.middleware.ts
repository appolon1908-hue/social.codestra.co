import crypto from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (SAFE_METHODS.has(req.method)) return next();
    // CSRF applies to browser cookie authentication. Non-browser clients that
    // authenticate exclusively with an explicit token header do not carry an
    // ambient browser credential and therefore are not CSRF-capable.
    if (!req.cookies?.auth && (req.headers.auth || req.headers.authorization)) {
      return next();
    }
    if (!req.cookies?.auth && !req.cookies?.refresh) return next();
    const cookie = req.cookies?.csrf;
    const header = req.header('x-csrf-token');
    if (
      typeof cookie !== 'string' ||
      typeof header !== 'string' ||
      cookie.length !== header.length ||
      !crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header))
    ) {
      return res.status(403).json({ error: 'csrf_validation_failed' });
    }
    next();
  }
}

@Injectable()
export class PublicAuthOriginMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.header('origin');
    if (!origin) return next();
    try {
      const expected = new URL(process.env.FRONTEND_URL!).origin;
      if (new URL(origin).origin !== expected) {
        return res.status(403).json({ error: 'origin_validation_failed' });
      }
    } catch {
      return res.status(403).json({ error: 'origin_validation_failed' });
    }
    next();
  }
}

export function issueCsrfCookie(response: Response) {
  const token = crypto.randomBytes(32).toString('base64url');
  response.cookie('csrf', token, {
    domain: process.env.COOKIE_DOMAIN || undefined,
    secure: !process.env.NOT_SECURED,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}
