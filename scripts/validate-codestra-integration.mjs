import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'codestra/integration/social-codestra.integration.v1.json');
const middlewareContractPath = path.join(root, 'codestra/integration/middleware-command-contract.v1.json');
const n8nContractPath = path.join(root, 'codestra/integration/n8n-orchestration.v1.json');
const openBaoAliasesPath = path.join(root, 'codestra/integration/openbao-secret-aliases.v1.json');
const envPath = path.join(root, 'codestra/integration/runtime.env.example');
const targetPath = path.join(root, 'monitoring/prometheus-target.disabled.yml');
const rulesPath = path.join(root, 'monitoring/codestra-social-recording-rules.yml');
const metricsContractPath = path.join(root, 'monitoring/social-codestra-metrics-contract.v1.json');
const docsPath = path.join(root, 'docs/CODESTRA-INTEGRATION-FILES.md');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`missing required file: ${path.relative(root, file)}`);
  return fs.readFileSync(file, 'utf8');
}

const manifest = JSON.parse(read(manifestPath));
const middlewareContract = JSON.parse(read(middlewareContractPath));
const n8nContract = JSON.parse(read(n8nContractPath));
const openBaoAliases = JSON.parse(read(openBaoAliasesPath));
const env = read(envPath);
const target = read(targetPath);
const rules = read(rulesPath);
const metricsContract = JSON.parse(read(metricsContractPath));
const docs = read(docsPath);

if (manifest.schemaVersion !== '1.0') fail('manifest schemaVersion must be 1.0');
if (manifest.application !== 'social.codestra.co') fail('manifest application must be social.codestra.co');
if (manifest.codestraBusiness !== 'codestra-social') fail('manifest codestraBusiness must be codestra-social');
if (manifest.status !== 'INTEGRATION_FILES_PREPARED_NOT_DEPLOYED') fail('manifest must remain not deployed');
if (manifest.identity?.browserSecretsAllowed !== false) fail('browser secrets must be disallowed');
if (manifest.gateway?.directProviderWritesAllowed !== false) fail('direct provider writes must be disallowed');
if (manifest.observability?.metricsEnabledByDefault !== false) fail('metrics must be disabled by default');
if (manifest.productionGates?.liveWritesEnabled !== false) fail('live writes must not be enabled');
if (manifest.productionGates?.metricsTargetEnabled !== false) fail('metrics target must not be enabled');
if (manifest.productionGates?.n8nWorkflowsImported !== false) fail('n8n workflows must not be marked imported');
if (manifest.productionGates?.n8nWorkflowsActive !== false) fail('n8n workflows must not be active by default');
if (manifest.middleware?.automationApi?.commands !== 'POST /v2/automation/commands') fail('manifest must point at Middleware automation commands API');
if (!manifest.middleware?.allowedCommands?.includes('email.message.send.v1')) fail('manifest must include email.message.send.v1');

if (metricsContract.schemaVersion !== '1.0') fail('metrics contract schemaVersion must be 1.0');
if (metricsContract.application !== manifest.application) fail('metrics contract application must match manifest');
if (metricsContract.codestraBusiness !== manifest.codestraBusiness) fail('metrics contract business must match manifest');
if (metricsContract.status !== 'CONTRACT_PREPARED_NOT_SCRAPED') fail('metrics contract must remain not scraped');
if (metricsContract.metricsEnabledByDefault !== false) fail('metrics contract must keep metrics disabled by default');

if (middlewareContract.status !== 'PREPARED_NOT_DEPLOYED') fail('middleware contract must remain prepared only');
if (middlewareContract.invariants?.n8nIsWriteAuthority !== false) fail('n8n must not be write authority');
if (middlewareContract.invariants?.externalProviderWritesBypassMiddleware !== false) fail('provider writes must not bypass Middleware');
if (!middlewareContract.transport?.forbiddenDirectTargets?.includes('social-provider-api')) fail('middleware contract must forbid direct social provider API targets');
for (const command of ['social.publication.request.v1', 'social.publication.cancel.v1', 'social.analytics.snapshot.request.v1', 'social.inbox.triage.request.v1']) {
  if (!middlewareContract.commands?.some((entry) => entry.type === command)) fail(`middleware contract missing command: ${command}`);
}

if (n8nContract.n8n?.role !== 'orchestrator') fail('n8n role must be orchestrator');
if (n8nContract.n8n?.writeAuthority !== false) fail('n8n write authority must be false');
if (n8nContract.n8n?.inactiveByDefault !== true) fail('n8n workflows must be inactive by default');
if (n8nContract.runtimeGate?.productionTrafficAllowed !== false) fail('n8n production traffic must not be allowed');
if (!n8nContract.workflowGroups?.some((entry) => entry.name === 'CP-POSTLY-COMMON-ERROR')) fail('n8n contract missing common error workflow');
for (const target of n8nContract.n8n?.allowedHttpTargets || []) {
  if (!target.startsWith('https://api.codestra.co/v2/automation/')) fail(`n8n target must use Middleware automation API: ${target}`);
}

if (openBaoAliases.authority !== 'Codestra-OpenBao') fail('OpenBao alias authority mismatch');
if (openBaoAliases.gitMayContainSecretValues !== false) fail('OpenBao aliases must not allow secret values in Git');
for (const alias of openBaoAliases.aliases || []) {
  if (!alias.name?.startsWith('social-codestra/')) fail(`OpenBao alias must be namespaced: ${alias.name}`);
}

for (const label of ['codestra_business', 'application', 'service', 'environment', 'server', 'region', 'deployment']) {
  if (!manifest.observability.requiredLabels.includes(label)) fail(`missing required label: ${label}`);
  if (!metricsContract.requiredLabels.includes(label)) fail(`metrics contract missing required label: ${label}`);
  if (!target.includes(label)) fail(`disabled Prometheus target must include label: ${label}`);
}

for (const forbidden of manifest.observability.forbiddenLabels) {
  if (!target.includes(`labeldrop`) || !target.includes(forbidden)) fail(`Prometheus target must drop forbidden label: ${forbidden}`);
  if (!metricsContract.forbiddenLabels.includes(forbidden)) fail(`metrics contract must forbid label: ${forbidden}`);
}

for (const metric of ['http_requests_total', 'codestra_webhook_delivery_total', 'codestra_publication_failures_total', 'codestra_middleware_command_total']) {
  if (!metricsContract.metricFamilies.some((family) => family.name === metric)) fail(`metrics contract missing family: ${metric}`);
}

for (const flag of ['CODESTRA_INTAKE_BFF_ENABLED=false', 'CODESTRA_COMMUNICATIONS_ENABLED=false', 'CODESTRA_VOICE_CONTROLS_ENABLED=false', 'CODESTRA_N8N_ORCHESTRATION_ENABLED=false', 'CODESTRA_PROVIDER_LIVE_DELIVERY_ENABLED=false', 'METRICS_ENABLED=false']) {
  if (!env.includes(flag)) fail(`runtime env template must keep disabled flag: ${flag}`);
}

for (const secret of ['CLIENT_SECRET=', 'TOKEN=', 'PASSWORD=', 'API_KEY=']) {
  if (env.includes(secret) && !env.includes('_FILE=')) fail(`runtime env contains inline secret pattern: ${secret}`);
}

for (const fragment of ['codestra_social:http_requests:rate5m', 'codestra_social:http_errors:ratio5m', 'codestra_social:middleware_command_failures:rate15m']) {
  if (!rules.includes(fragment)) fail(`recording rules missing ${fragment}`);
}

for (const fragment of ['Caddy', 'Kong', 'Middleware', 'Activation Gates', 'CP-POSTLY-COMMON-ERROR']) {
  if (!docs.includes(fragment)) fail(`docs missing ${fragment}`);
}

console.log('Codestra social integration files validation PASS');
