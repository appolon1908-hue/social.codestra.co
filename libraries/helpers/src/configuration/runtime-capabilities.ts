export type RuntimeCapability =
  | 'BILLING_LIVE_CHARGE'
  | 'EXTERNAL_MODEL_CALLS_ENABLED'
  | 'WEBHOOK_DELIVERY_ENABLED';

export function isRuntimeCapabilityEnabled(
  capability: RuntimeCapability,
  environment: NodeJS.ProcessEnv = process.env
): boolean {
  return environment[capability] === 'true';
}

export function requireRuntimeCapability(
  capability: RuntimeCapability,
  environment: NodeJS.ProcessEnv = process.env
): void {
  if (!isRuntimeCapabilityEnabled(capability, environment)) {
    throw new Error(`runtime_capability_disabled:${capability}`);
  }
}
