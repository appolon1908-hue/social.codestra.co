import crypto from 'node:crypto';
import fs from 'node:fs';
import yaml from 'js-yaml';
const contractPath = 'contracts/openapi/codestra-social-enterprise-v2.yaml';
const outputPath = 'apps/sdk/src/generated/operations.ts';
const source = fs.readFileSync(contractPath, 'utf8');
const contract = yaml.load(source);
const operations = [];
for (const value of Object.values(contract.paths ?? {}))
  for (const operation of Object.values(value ?? {}))
    if (operation && typeof operation === 'object' && operation.operationId)
      operations.push(operation.operationId);
operations.sort();
const hash = crypto.createHash('sha256').update(source).digest('hex');
const generated = `// Generated from ${contractPath}.\n// Run \`pnpm generate:social-sdk\`; do not edit manually.\nexport const CONTRACT_VERSION = ${JSON.stringify(
  contract.info.version
)};\nexport const CONTRACT_SHA256 = ${JSON.stringify(
  hash
)};\nexport const OPERATION_IDS = ${JSON.stringify(
  operations,
  null,
  2
)} as const;\nexport type CodestraOperationId = (typeof OPERATION_IDS)[number];\n`;
fs.mkdirSync('apps/sdk/src/generated', { recursive: true });
fs.writeFileSync(outputPath, generated);
console.log(
  `Generated ${operations.length} Codestra SDK operations (${hash.slice(
    0,
    12
  )})`
);
