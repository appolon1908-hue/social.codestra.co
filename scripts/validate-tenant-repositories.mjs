import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync(
  'git',
  [
    'ls-files',
    'libraries/nestjs-libraries/src/database/prisma/**/*.repository.ts',
  ],
  { encoding: 'utf8' }
)
  .trim()
  .split('\n')
  .filter(Boolean);
const violations = [];
for (const file of files) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (/\bfindById\s*\(\s*(?:id|string|number)\b/.test(line))
        violations.push(`${file}:${index + 1}`);
    });
}
if (violations.length) {
  console.error(
    `Potential tenant-unsafe generic repository lookup:\n${violations.join(
      '\n'
    )}`
  );
  process.exit(1);
}
console.log('Tenant repository naming guard passed');
