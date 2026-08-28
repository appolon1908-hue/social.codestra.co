import { existsSync, readFileSync } from 'node:fs';

const contract = 'contracts/asyncapi/social-events-v2.yaml';
if (!existsSync(contract)) {
  console.log(
    'AsyncAPI social-events-v2 contract is deferred to BE-1; no durable social event may merge before it'
  );
  process.exit(0);
}
const source = readFileSync(contract, 'utf8');
for (const required of [
  'asyncapi:',
  'channels:',
  'messageId:',
  'correlationId',
]) {
  if (!source.includes(required))
    throw new Error(`${contract} is missing ${required}`);
}
console.log('AsyncAPI foundation validation passed');
