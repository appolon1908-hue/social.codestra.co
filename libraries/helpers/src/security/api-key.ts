import crypto from 'node:crypto';
import { safeFingerprint, secretHmac } from './envelope.crypto';

export type GeneratedApiKey = {
  value: string;
  hash: string;
  fingerprint: string;
  lastFour: string;
};

export function generateApiKey(): GeneratedApiKey {
  const value = `cds_${crypto.randomBytes(32).toString('base64url')}`;
  return {
    value,
    hash: secretHmac(value, 'codestra-api-key-v1'),
    fingerprint: safeFingerprint(value),
    lastFour: value.slice(-4),
  };
}

export function hashApiKey(value: string): string {
  return secretHmac(value, 'codestra-api-key-v1');
}

