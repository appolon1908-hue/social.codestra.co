import { existsSync, readFileSync } from 'node:fs';

const contract = 'contracts/openapi/social-v2.yaml';
if (!existsSync(contract)) {
  console.log(
    'OpenAPI social-v2 contract is deferred to BE-1; no /v2/social implementation may merge before it'
  );
  process.exit(0);
}
const source = readFileSync(contract, 'utf8');
for (const required of [
  'openapi:',
  '/v2/social',
  'operationId:',
  'application/problem+json',
]) {
  if (!source.includes(required))
    throw new Error(`${contract} is missing ${required}`);
}
console.log('OpenAPI foundation validation passed');
