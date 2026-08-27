import { sign, verify } from 'jsonwebtoken';
import { hashSync, compareSync, getRounds } from 'bcrypt';
import crypto from 'crypto';
import { randomUUID } from 'node:crypto';
import { loadSecret } from '@gitroom/helpers/security/secret-file';
// @ts-ignore
import EVP_BytesToKey from 'evp_bytestokey';
const algorithm = 'aes-256-cbc';
const { keyLength, ivLength } = crypto.getCipherInfo(algorithm);

function deriveLegacyKeyIv(secret: string) {
  const { keyLength, ivLength } = crypto.getCipherInfo(algorithm); // 32, 16
  const pass = Buffer.isBuffer(secret)
    ? secret
    : Buffer.from(secret ?? '', 'utf8');

  // evp_bytestokey: key length in **bits**, IV length in **bytes**
  const { key, iv } = EVP_BytesToKey(
    pass,
    null,
    keyLength * 8,
    ivLength,
    'md5'
  );

  if (key.length !== keyLength || iv.length !== ivLength) {
    throw new Error(`Derived wrong sizes (key=${key.length}, iv=${iv.length})`);
  }
  return { key, iv };
}

export function decrypt_legacy_using_IV(hexCiphertext: string) {
  const { key, iv } = deriveLegacyKeyIv(process.env.JWT_SECRET);
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  const out = Buffer.concat([
    decipher.update(hexCiphertext, 'hex'),
    decipher.final(),
  ]);
  return out.toString('utf8');
}

export function encrypt_legacy_using_IV(utf8Plaintext: string) {
  const { key, iv } = deriveLegacyKeyIv(process.env.JWT_SECRET);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const out = Buffer.concat([
    cipher.update(utf8Plaintext, 'utf8'),
    cipher.final(),
  ]);
  return out.toString('hex');
}
export class AuthService {
  static hashPassword(password: string) {
    return hashSync(password, Number(process.env.BCRYPT_COST || '12'));
  }
  static comparePassword(password: string, hash: string) {
    return compareSync(password, hash);
  }
  static passwordHashNeedsUpgrade(hash: string) {
    return getRounds(hash) < Number(process.env.BCRYPT_COST || '12');
  }
  static signJWT(value: object) {
    return sign(value, loadSecret('JWT_SIGNING_KEY', 'JWT_SECRET'), {
      algorithm: 'HS256',
      issuer: process.env.JWT_ISSUER || 'https://social.codestra.co',
      audience: process.env.JWT_AUDIENCE || 'codestra-social',
      expiresIn: '15m',
      jwtid: randomUUID(),
    });
  }
  static verifyJWT(token: string) {
    return verify(token, loadSecret('JWT_SIGNING_KEY', 'JWT_SECRET'), {
      algorithms: ['HS256'],
      issuer: process.env.JWT_ISSUER || 'https://social.codestra.co',
      audience: process.env.JWT_AUDIENCE || 'codestra-social',
    });
  }

  static signPurposeToken(
    value: object,
    purpose: string,
    expiresIn: string | number
  ) {
    return sign(
      { ...value, purpose },
      loadSecret('PASSWORD_RESET_SIGNING_KEY'),
      {
        algorithm: 'HS256',
        issuer: process.env.JWT_ISSUER || 'https://social.codestra.co',
        audience: `${process.env.JWT_AUDIENCE || 'codestra-social'}:${purpose}`,
        expiresIn: expiresIn as any,
        jwtid: randomUUID(),
      }
    );
  }

  static verifyPurposeToken(token: string, purpose: string) {
    const payload = verify(token, loadSecret('PASSWORD_RESET_SIGNING_KEY'), {
      algorithms: ['HS256'],
      issuer: process.env.JWT_ISSUER || 'https://social.codestra.co',
      audience: `${process.env.JWT_AUDIENCE || 'codestra-social'}:${purpose}`,
    }) as Record<string, unknown>;
    if (payload.purpose !== purpose) throw new Error('Invalid token purpose');
    return payload;
  }

  static fixedEncryption(value: string) {
    return encrypt_legacy_using_IV(value);
  }

  static fixedDecryption(hash: string) {
    return decrypt_legacy_using_IV(hash);
  }
}
