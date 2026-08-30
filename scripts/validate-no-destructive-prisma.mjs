import { readFileSync } from 'node:fs';

const inputs = [
  [
    'package.json',
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ],
  [
    'backend-ci.yml',
    readFileSync(
      new URL('../.github/workflows/backend-ci.yml', import.meta.url),
      'utf8'
    ),
  ],
];
const forbidden = [
  /prisma\s+db\s+push/i,
  /--accept-data-loss/i,
  /prisma\s+migrate\s+reset/i,
  /--force-reset/i,
];
const violations = inputs.flatMap(([file, content]) =>
  forbidden
    .filter((pattern) => pattern.test(content))
    .map((pattern) => `${file}: ${pattern}`)
);
if (violations.length) {
  console.error(
    `Forbidden destructive Prisma command:\n${violations.join('\n')}`
  );
  process.exit(1);
}
console.log('No destructive Prisma commands in package scripts or backend CI');
