export interface N8nNodeDescriptor {
  displayName: string;
  name: string;
  group: string[];
  version: number;
  description: string;
  defaults: { name: string };
  inputs: string[];
  outputs: string[];
  properties: Array<Record<string, unknown>>;
}
