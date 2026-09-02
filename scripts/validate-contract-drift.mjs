import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

execFileSync(
  process.execPath,
  ['scripts/social-route-inventory.mjs', '--check'],
  {
    stdio: 'inherit',
  }
);

const inventory = JSON.parse(
  readFileSync('contracts/generated/social-route-inventory.json', 'utf8')
);
const routeIdentities = new Set(
  inventory.routes.map(({ method, path }) => `${method} ${path}`)
);
const requiredMiddlewareTransports = [
  '/.well-known/oauth-authorization-server',
  '/.well-known/oauth-protected-resource',
  '/.well-known/openai-apps-challenge',
  '/mcp',
  '/mcp-oauth',
  '/mcp/:id',
  '/message/:id',
  '/sse/:id',
];
const missingMiddlewareTransports = requiredMiddlewareTransports.filter(
  (path) => !routeIdentities.has(`ANY ${path}`)
);
if (missingMiddlewareTransports.length) {
  throw new Error(
    `Route inventory omits middleware transports: ${missingMiddlewareTransports.join(
      ', '
    )}`
  );
}

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
