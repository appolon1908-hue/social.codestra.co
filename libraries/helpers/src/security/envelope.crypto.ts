import crypto from 'node:crypto';
import { loadSecret } from './secret-file';

export type EncryptedValue = {
  ciphertext: string;
  nonce: string;
  keyVersion: number;
  fingerprint: string;
};

function keyForVersion(version: number): Buffer {
  const encoded = loadSecret(`DATA_ENCRYPTION_KEY_V${version}`);
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('Data encryption key must be 32 bytes');
  return key;
}

export function encryptSecret(value: string, context: string): EncryptedValue {
  const keyVersion = Number(process.env.DATA_ENCRYPTION_KEY_VERSION || '1');
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyForVersion(keyVersion), nonce);
  cipher.setAAD(Buffer.from(context, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]).toString('base64');
  return {
    ciphertext,
    nonce: nonce.toString('base64'),
    keyVersion,
    fingerprint: crypto.createHash('sha256').update(value).digest('hex').slice(0, 16),
  };
}

export function decryptSecret(value: EncryptedValue, context: string): string {
  const packed = Buffer.from(value.ciphertext, 'base64');
  if (packed.length < 17) throw new Error('Invalid encrypted value');
  const encrypted = packed.subarray(0, -16);
  const tag = packed.subarray(-16);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    keyForVersion(value.keyVersion),
    Buffer.from(value.nonce, 'base64')
  );
  decipher.setAAD(Buffer.from(context, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function secretHmac(
  value: string,
  purpose: string,
  keyName = 'API_KEY_PEPPER'
): string {
  const pepper = loadSecret(keyName);
  return crypto.createHmac('sha256', pepper).update(`${purpose}\0${value}`).digest('hex');
}

export function verificationHmac(value: string, purpose: string, keyName: string): string {
  return crypto
    .createHmac('sha256', loadSecret(keyName))
    .update(`${purpose}\0${value}`)
    .digest('hex');
}

export function safeFingerprint(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}
