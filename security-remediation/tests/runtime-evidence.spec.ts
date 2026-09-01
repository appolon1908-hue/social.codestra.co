import {
  runtimeCapabilities,
  runtimeVersion,
  safetyState,
} from '../../apps/backend/src/api/routes/runtime-evidence';

describe('runtime evidence', () => {
  it('does not convert absent or malformed safety flags into disabled evidence', () => {
    expect(safetyState(undefined)).toBe('UNKNOWN');
    expect(safetyState('False')).toBe('UNKNOWN');
    expect(safetyState('1')).toBe('UNKNOWN');
  });

  it('reports only exact boolean safety states', () => {
    expect(safetyState('true')).toBe('ENABLED');
    expect(safetyState('false')).toBe('DISABLED');
  });

  it('fails closed when a write capability or kill switch is unknown', () => {
    const evidence = runtimeCapabilities({
      SOCIAL_PUBLISH: 'false',
      PUBLISHING_KILL_SWITCH: 'true',
    });
    expect(evidence.safety.SOCIAL_PUBLISH).toBe('DISABLED');
    expect(evidence.safety.SOCIAL_PROVIDER_WRITES).toBe('UNKNOWN');
    expect(evidence.production_business_writes_enabled).toBe('UNKNOWN');
    expect(evidence.production_write_safety).toBe('UNKNOWN');
  });

  it('proves writes disabled only when all flags and the kill switch agree', () => {
    const environment = Object.fromEntries(
      [
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
      ].map((name) => [name, 'false'])
    );
    const evidence = runtimeCapabilities({
      ...environment,
      PUBLISHING_KILL_SWITCH: 'true',
    });
    expect(evidence.production_business_writes_enabled).toBe(false);
    expect(evidence.production_write_safety).toBe('PASS');
  });

  it('sanitizes release evidence and never exposes arbitrary environment data', () => {
    expect(
      runtimeVersion({
        SOURCE_REVISION: 'abc123; secret',
        IMAGE_DIGEST: 'sha256:abc$bad',
        IMAGE_VERSION: 'release 1',
        BUILD_CREATED: '2026-09-01T17:00:00Z',
        SECRET_TOKEN: 'do-not-return',
      })
    ).toEqual({
      source_revision: 'unknown',
      image_digest: 'unknown',
      image_version: 'unknown',
      build_created: '2026-09-01T17:00:00Z',
    });
  });

  it('returns valid immutable release identity verbatim', () => {
    const revision = 'a'.repeat(40);
    const digest = `sha256:${'b'.repeat(64)}`;
    expect(
      runtimeVersion({
        SOURCE_REVISION: revision,
        IMAGE_DIGEST: digest,
        IMAGE_VERSION: 'release-2026.09.01',
        BUILD_CREATED: '2026-09-01T17:00:00.123Z',
      })
    ).toEqual({
      source_revision: revision,
      image_digest: digest,
      image_version: 'release-2026.09.01',
      build_created: '2026-09-01T17:00:00.123Z',
    });
  });
});
