import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync(
  'git',
  [
    'ls-files',
    'apps/backend/**/*.ts',
    'apps/orchestrator/**/*.ts',
    'libraries/**/*.ts',
  ],
  { encoding: 'utf8' }
)
  .trim()
  .split('\n')
  .filter(Boolean);
const forbidden = /https?:\/\/[^\s'"`]*(?:odoo|klyrow|telnexa|n8n)[^\s'"`]*/i;
const violations = [];
for (const file of files) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (forbidden.test(line)) violations.push(`${file}:${index + 1}`);
    });
}
if (violations.length) {
  console.error(
    `Direct cross-system endpoints are forbidden; use Middleware:\n${violations.join(
      '\n'
    )}`
  );
  process.exit(1);
}
console.log('No direct Codestra cross-system endpoints found');
