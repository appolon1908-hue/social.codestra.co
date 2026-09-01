export const SAFETY_FLAGS = [
  'SOCIAL_PUBLISH',
  'SOCIAL_PROVIDER_WRITES',
  'SOCIAL_CALLBACK_PROCESSING',
  'SOCIAL_OUTBOX_DELIVERY',
  'SOCIAL_DEAD_LETTER_REPLAY',
  'BILLING_LIVE_CHARGE',
  'ODOO_WRITE',
  'N8N_DELIVERY_ENABLED',
  'KLYROW_WRITE',
  'TELNEXA_WRITE',
  'PRODUCTION_DEPLOYMENT',
] as const;

export type SafetyState = 'ENABLED' | 'DISABLED' | 'UNKNOWN';

export function safetyState(value: string | undefined): SafetyState {
  if (value === 'true') return 'ENABLED';
  if (value === 'false') return 'DISABLED';
  return 'UNKNOWN';
}

export function sanitizedReleaseValue(
  value: string | undefined,
  accepted: RegExp
) {
  return value && accepted.test(value) ? value : 'unknown';
}

type RuntimeEnvironment = Record<string, string | undefined>;

export function runtimeVersion(environment: RuntimeEnvironment) {
  return {
    source_revision: sanitizedReleaseValue(
      environment.SOURCE_REVISION,
      /^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/
    ),
    image_digest: sanitizedReleaseValue(
      environment.IMAGE_DIGEST,
      /^sha256:[a-fA-F0-9]{64}$/
    ),
    image_version: sanitizedReleaseValue(
      environment.IMAGE_VERSION,
      /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/
    ),
    build_created: sanitizedReleaseValue(
      environment.BUILD_CREATED,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
    ),
  };
}

export function runtimeCapabilities(environment: RuntimeEnvironment) {
  const safety = Object.fromEntries(
    SAFETY_FLAGS.map((name) => [name, safetyState(environment[name])])
  );
  const killSwitch = safetyState(environment.PUBLISHING_KILL_SWITCH);
  const hasEnabledWrite = Object.values(safety).some(
    (state) => state === 'ENABLED'
  );
  const hasUnknown = Object.values(safety).some((state) => state === 'UNKNOWN');
  const writeState = hasEnabledWrite
    ? true
    : hasUnknown || killSwitch === 'UNKNOWN'
    ? 'UNKNOWN'
    : killSwitch === 'ENABLED'
    ? false
    : true;

  return {
    service: 'codestra-social-runtime',
    safety,
    publishing_kill_switch: killSwitch,
    production_business_writes_enabled: writeState,
    production_write_safety:
      writeState === false ? 'PASS' : writeState === true ? 'FAIL' : 'UNKNOWN',
  };
}
