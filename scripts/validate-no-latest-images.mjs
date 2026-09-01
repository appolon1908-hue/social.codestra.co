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
const productionCompose = readFileSync('docker-compose.yaml', 'utf8');
productionCompose.split('\n').forEach((line, index) => {
  const match = line.match(/^\s*image:\s+(.+)\s*$/);
  if (!match) return;
  const image = match[1].trim();
  if (image.startsWith('${')) return;
  if (!/@sha256:[a-f0-9]{64}$/i.test(image))
    violations.push(`docker-compose.yaml:${index + 1} (digest required)`);
});
if (violations.length) {
  console.error(
    `Mutable production images are forbidden:\n${violations.join('\n')}`
  );
  process.exit(1);
}
console.log('No moving latest or unpinned literal production images found');
