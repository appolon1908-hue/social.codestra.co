import fs from 'node:fs';
import yaml from 'js-yaml';

const kongPath = 'deploy/gateway/kong-social-v2.example.yaml';
const caddyPath = 'deploy/gateway/Caddyfile.social-v2.example';
const kong = yaml.load(fs.readFileSync(kongPath, 'utf8'));
const caddy = fs.readFileSync(caddyPath, 'utf8');

const fail = (message) => {
  throw new Error(`kong_social_policy_failed:${message}`);
};

const services = kong?.services ?? [];
if (services.length !== 1) fail('exactly_one_social_service_required');
const service = services[0];
if (service.name !== 'codestra-middleware-social-v2')
  fail('middleware_service_required');
if (!String(service.url).startsWith('https://middleware:')) {
  fail('https_middleware_upstream_required');
}
if ((service.retries ?? 0) > 1) fail('unsafe_automatic_upstream_retries');

const routes = service.routes ?? [];
const expected = new Map([
  ['codestra-social-api-v2', '/v2/social'],
  ['codestra-social-webhooks-v2', '/v2/webhooks/social'],
]);
if (routes.length !== expected.size) fail('unexpected_route_count');
for (const route of routes) {
  if (route.hosts?.length !== 1 || route.hosts[0] !== 'api.codestra.co') {
    fail(`invalid_host:${route.name}`);
  }
  if (route.protocols?.length !== 1 || route.protocols[0] !== 'https') {
    fail(`https_only_required:${route.name}`);
  }
  if (
    route.paths?.length !== 1 ||
    route.paths[0] !== expected.get(route.name)
  ) {
    fail(`unexpected_path:${route.name}`);
  }
  if (route.strip_path !== false || route.preserve_host !== true) {
    fail(`route_identity_policy:${route.name}`);
  }
  const serialized = JSON.stringify(route).toLowerCase();
  if (serialized.includes('/internal') || serialized.includes('/monitor')) {
    fail(`private_route_exposed:${route.name}`);
  }
}

const plugins = kong?.plugins ?? [];
for (const name of [
  'correlation-id',
  'request-transformer',
  'response-transformer',
]) {
  if (
    !plugins.some(
      (plugin) => plugin.name === name && plugin.service === service.name
    )
  ) {
    fail(`missing_service_plugin:${name}`);
  }
}
for (const routeName of expected.keys()) {
  const size = plugins.find(
    (plugin) =>
      plugin.name === 'request-size-limiting' && plugin.route === routeName
  );
  if (!size?.config?.require_content_length)
    fail(`body_limit_required:${routeName}`);
  const rate = plugins.find(
    (plugin) => plugin.name === 'rate-limiting' && plugin.route === routeName
  );
  if (
    rate?.config?.policy !== 'redis' ||
    rate.config.fault_tolerant !== false
  ) {
    fail(`fail_closed_redis_rate_limit_required:${routeName}`);
  }
}

const transformer = plugins.find(
  (plugin) => plugin.name === 'request-transformer'
);
const strippedHeaders = new Set(
  (transformer?.config?.remove?.headers ?? []).map((header) =>
    header.toLowerCase()
  )
);
for (const header of [
  'x-authenticated-user',
  'x-authenticated-tenant',
  'x-consumer-id',
  'x-forwarded-client-cert',
  'x-service-identity',
]) {
  if (!strippedHeaders.has(header))
    fail(`spoofable_header_not_removed:${header}`);
}

for (const blockedPath of [
  '/internal/*',
  '/monitor/metrics*',
  '/monitor/ready*',
  '/monitor/version*',
]) {
  if (!caddy.includes(blockedPath))
    fail(`caddy_private_path_missing:${blockedPath}`);
}
if (!caddy.includes('respond @private 404'))
  fail('caddy_private_paths_not_hidden');
if (!caddy.includes('@dangerous method TRACE CONNECT')) {
  fail('caddy_dangerous_methods_not_blocked');
}

console.log('Codestra Social Kong/Caddy isolation policy passed');
