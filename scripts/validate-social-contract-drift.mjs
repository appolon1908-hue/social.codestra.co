import crypto from 'node:crypto';
import fs from 'node:fs';
import yaml from 'js-yaml';
const contracts = [
  'contracts/openapi/codestra-social-enterprise-v2.yaml',
  'contracts/asyncapi/codestra-social-events-v1.yaml',
];
const parsedContracts = [];
for (const file of contracts) {
  const parsed = yaml.load(fs.readFileSync(file, 'utf8'));
  if (!parsed.info?.version)
    throw new Error(`contract_version_missing:${file}`);
  parsedContracts.push(parsed);
}
const [restContract, eventContract] = parsedContracts;
const operationIds = new Set();
for (const [path, pathItem] of Object.entries(restContract.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem ?? {})) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
    if (!operation.operationId)
      throw new Error(`operation_id_missing:${method}:${path}`);
    if (operationIds.has(operation.operationId))
      throw new Error(`operation_id_duplicate:${operation.operationId}`);
    operationIds.add(operation.operationId);
    if (method !== 'get') {
      const parameters = [
        ...(pathItem.parameters ?? []),
        ...(operation.parameters ?? []),
      ];
      const refs = parameters.map((parameter) => parameter.$ref ?? '');
      if (!refs.some((ref) => ref.endsWith('/CorrelationId')))
        throw new Error(`correlation_header_missing:${operation.operationId}`);
      if (!refs.some((ref) => ref.endsWith('/IdempotencyKey')))
        throw new Error(`idempotency_header_missing:${operation.operationId}`);
    }
  }
}
if (eventContract.defaultContentType !== 'application/cloudevents+json')
  throw new Error('cloudevents_content_type_required');
if (!eventContract.components?.schemas?.SignatureHeaders)
  throw new Error('webhook_signature_headers_missing');
const openapi = fs.readFileSync(contracts[0], 'utf8');
const generated = fs.readFileSync(
  'apps/sdk/src/generated/operations.ts',
  'utf8'
);
const hash = crypto.createHash('sha256').update(openapi).digest('hex');
if (
  !generated.includes(`CONTRACT_SHA256 = '${hash}'`) &&
  !generated.includes(`CONTRACT_SHA256 = "${hash}"`)
)
  throw new Error('social_sdk_contract_drift');
for (const required of [
  'createCampaign',
  'submitApproval',
  'requestPublication',
  'submitConnectorCommand',
  'createWebhookEndpoint',
])
  if (!generated.includes(`"${required}"`))
    throw new Error(`sdk_operation_missing:${required}`);
console.log('Codestra Social contracts and generated SDK are synchronized');
