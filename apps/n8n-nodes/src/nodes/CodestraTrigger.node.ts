import { N8nNodeDescriptor } from '../types';
export const triggerEvents = [
  'content.approved',
  'campaign.activated',
  'publication.completed',
  'publication.failed',
  'engagement.received',
  'engagement.sla_breached',
  'subscription.changed',
  'connector.unhealthy',
  'delivery.dead_lettered',
] as const;
export class CodestraTriggerNode {
  description: N8nNodeDescriptor = {
    displayName: 'Codestra Social Trigger',
    name: 'codestraTrigger',
    group: ['trigger'],
    version: 1,
    description: 'Receive signed normalized Codestra events',
    defaults: { name: 'Codestra Social Trigger' },
    inputs: [],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        options: triggerEvents.map((name) => ({ name, value: name })),
        default: [...triggerEvents],
      },
    ],
  };
}
