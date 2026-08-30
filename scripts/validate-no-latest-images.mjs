import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync(
  'git',
  ['ls-files', '*.yml', '*.yaml', 'Dockerfile*'],
  { encoding: 'utf8' }
)
  .trim()
  .split('\n')
  .filter((file) => file && !file.includes('.dev.'));
const violations = [];
for (const file of files) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (/^\s*(?:FROM|image:)\s+\S+:latest(?:\s|$)/i.test(line))
        violations.push(`${file}:${index + 1}`);
    });
}
if (violations.length) {
  console.error(
    `Moving latest images are forbidden:\n${violations.join('\n')}`
  );
  process.exit(1);
}
console.log('No moving latest images found');
