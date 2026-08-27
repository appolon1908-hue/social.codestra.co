import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const root = fileURLToPath(new URL('../', import.meta.url));
const schema = `${root}libraries/nestjs-libraries/src/database/prisma/schema.prisma`;
const baselineName = '20260803000100_codestra_production_baseline';
const baseline = `${root}libraries/nestjs-libraries/src/database/prisma/migrations/${baselineName}/migration.sql`;
const prismaCli = `${root}node_modules/prisma/build/index.js`;

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const prisma = new PrismaClient();
let state;
try {
  [state] = await prisma.$queryRaw`
    SELECT
      to_regclass('public."_prisma_migrations"')::text AS "migrationsTable",
      to_regclass('public."User"')::text AS "baselineTable"
  `;
} finally {
  await prisma.$disconnect();
}

if (!state?.migrationsTable && state?.baselineTable) {
  throw new Error(
    'existing_untracked_database_requires_reviewed_prisma_baseline'
  );
}

if (!state?.migrationsTable) {
  console.log('[codestra-migrate] applying reviewed empty-database baseline');
  runPrisma(['db', 'execute', '--file', baseline, '--schema', schema]);
  runPrisma([
    'migrate',
    'resolve',
    '--applied',
    baselineName,
    '--schema',
    schema,
  ]);
}

runPrisma(['migrate', 'deploy', '--schema', schema]);
