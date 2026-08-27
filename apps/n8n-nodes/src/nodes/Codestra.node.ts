import crypto from 'node:crypto';
import { N8nNodeDescriptor } from '../types';
const operations = [
  'createCampaign',
  'generateContent',
  'submitApproval',
  'schedulePublication',
  'assignEngagement',
  'escalateEngagement',
  'requestReport',
] as const;
export class CodestraNode {
  description: N8nNodeDescriptor = {
    displayName: 'Codestra Social',
    name: 'codestra',
    group: ['transform'],
    version: 1,
    description:
      'Execute governed Codestra Social commands through Kong and Middleware',
    defaults: { name: 'Codestra Social' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        options: operations.map((name) => ({ name, value: name })),
        default: 'createCampaign',
      },
      { displayName: 'Payload', name: 'payload', type: 'json', default: '{}' },
      {
        displayName: 'Idempotency Key',
        name: 'idempotencyKey',
        type: 'string',
        default: '',
      },
    ],
  };
  async execute(input: {
    baseUrl: string;
    accessToken: string;
    tenantId: string;
    operation: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
    fetch?: typeof fetch;
  }) {
    if (!operations.includes(input.operation as any))
      throw new Error('codestra_operation_invalid');
    const fetcher = input.fetch ?? fetch;
    const correlationId = crypto.randomUUID();
    const idempotencyKey = input.idempotencyKey || crypto.randomUUID();
    const response = await fetcher(`${input.baseUrl}/automation/commands`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        'content-type': 'application/json',
        'x-tenant-id': input.tenantId,
        'x-correlation-id': correlationId,
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        operation: input.operation,
        payload: input.payload,
      }),
    });
    if (!response.ok)
      throw new Error(`codestra_command_failed:${response.status}`);
    return response.json();
  }
}
