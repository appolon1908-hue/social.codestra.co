import fs from 'node:fs';

/** Load a secret from an owner-protected file without making it public config. */
export function loadSecret(name: string, legacyName?: string): string {
  const file = process.env[`${name}_FILE`];
  if (file) {
    const value = fs.readFileSync(file, { encoding: 'utf8' }).trim();
    if (!value) throw new Error(`${name}_FILE is empty`);
    return value;
  }

  const value = process.env[name] || (legacyName ? process.env[legacyName] : undefined);
  if (!value) throw new Error(`${name}_FILE is required`);
  return value;
}

