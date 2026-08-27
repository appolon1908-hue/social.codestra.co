import { spawnSync } from 'node:child_process';

const action = process.argv[2];
if (!['push', 'reset'].includes(action)) {
  throw new Error('usage: prisma-destructive-local.mjs <push|reset>');
}
if (process.env.ALLOW_DESTRUCTIVE_LOCAL_DB !== 'true') {
  throw new Error('ALLOW_DESTRUCTIVE_LOCAL_DB=true is required');
}
if (process.env.NODE_ENV === 'production') {
  throw new Error('destructive Prisma commands are forbidden in production');
}

let database;
try {
  database = new URL(process.env.DATABASE_URL || '');
} catch {
  throw new Error('a valid local DATABASE_URL is required');
}
if (
  database.protocol !== 'postgresql:' ||
  !['localhost', '127.0.0.1', '::1'].includes(database.hostname)
) {
  throw new Error(
    'destructive Prisma commands require a loopback PostgreSQL host'
  );
}
const databaseName = database.pathname.replace(/^\//, '');
if (
  !databaseName ||
  ['postgres', 'template0', 'template1'].includes(databaseName)
) {
  throw new Error('destructive Prisma commands require a dedicated database');
}

const schema = './libraries/nestjs-libraries/src/database/prisma/schema.prisma';
const args =
  action === 'reset'
    ? ['prisma', 'migrate', 'reset', '--force', '--schema', schema]
    : ['prisma', 'db', 'push', '--accept-data-loss', '--schema', schema];
const result = spawnSync('pnpm', args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
