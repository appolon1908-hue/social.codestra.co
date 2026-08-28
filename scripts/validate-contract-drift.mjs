import { existsSync } from 'node:fs';

const required = [
  'contracts/openapi/social-v2.yaml',
  'contracts/asyncapi/social-events-v2.yaml',
  'contracts/url-registry.yaml',
  'contracts/authority-map.yaml',
];
const present = required.filter(existsSync);
if (present.length !== 0 && present.length !== required.length) {
  throw new Error(
    `Partial contract foundation is forbidden. Missing: ${required
      .filter((file) => !existsSync(file))
      .join(', ')}`
  );
}
console.log(
  present.length
    ? 'Contract foundation is complete'
    : 'Contract foundation deferred atomically to BE-1'
);
