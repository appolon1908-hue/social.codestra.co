import fs from 'node:fs';
import path from 'node:path';

const fail = (message) => {
  throw new Error(`social_release_policy_failed:${message}`);
};

const forbiddenEnabled = [
  'ENABLE_EXTERNAL_DELIVERY',
  'LIVE_WRITE',
  'LIVE_WRITES',
  'ODOO_WRITE',
  'N8N_DELIVERY_ENABLED',
  'SOCIAL_AI_GENERATION_ENABLED',
  'SEND_EVENTS',
];

const inspected = [
  '.github/workflows/codestra-ci.yml',
  'deploy/compose.candidate.yaml',
];
for (const filename of inspected) {
  const source = fs.readFileSync(filename, 'utf8');
  for (const flag of forbiddenEnabled) {
    const enabled = new RegExp(`\\b${flag}\\s*[:=]\\s*['\"]?true['\"]?`, 'i');
    if (enabled.test(source))
      fail(`live_capability_enabled:${filename}:${flag}`);
  }
}

const controller = fs.readFileSync(
  'apps/backend/src/api/routes/internal-social.controller.ts',
  'utf8'
);
for (const route of [
  '/brands',
  '/brain/generations',
  '/approval-policies',
  '/approvals',
  '/campaigns',
  '/campaign-calendar',
  '/engagement',
  '/commands/publish',
]) {
  if (!controller.includes(`'${route}'`)) fail(`required_api_missing:${route}`);
}

const outbox = fs.readFileSync(
  'libraries/nestjs-libraries/src/database/prisma/social-control/social-engagement.service.ts',
  'utf8'
);
if (!outbox.includes("metadata: { destination: 'middleware' }"))
  fail('engagement_escalation_must_target_middleware');
if (/https?:\/\/(?:odoo|n8n|klyrow|telnexa)/i.test(outbox))
  fail('direct_enterprise_connector_write_detected');

const migrations = fs
  .readdirSync('libraries/nestjs-libraries/src/database/prisma/migrations', {
    withFileTypes: true,
  })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
if (new Set(migrations).size !== migrations.length)
  fail('duplicate_migration_directory');
for (const migration of migrations) {
  const sql = path.join(
    'libraries/nestjs-libraries/src/database/prisma/migrations',
    migration,
    'migration.sql'
  );
  if (!fs.existsSync(sql) || !fs.readFileSync(sql, 'utf8').trim())
    fail(`empty_migration:${migration}`);
}

console.log('Codestra Social release policy passed');
