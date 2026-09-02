import {
  isRuntimeCapabilityEnabled,
  requireRuntimeCapability,
} from '@gitroom/helpers/configuration/runtime-capabilities';

describe('production runtime capability gates', () => {
  it.each([undefined, '', 'false', 'FALSE', '1', 'yes'])(
    'fails closed for %p',
    (value) => {
      const environment = {
        NODE_ENV: 'test',
        BILLING_LIVE_CHARGE: value,
      } as NodeJS.ProcessEnv;
      expect(
        isRuntimeCapabilityEnabled('BILLING_LIVE_CHARGE', environment)
      ).toBe(false);
      expect(() =>
        requireRuntimeCapability('BILLING_LIVE_CHARGE', environment)
      ).toThrow('runtime_capability_disabled:BILLING_LIVE_CHARGE');
    }
  );

  it('accepts only the canonical true value', () => {
    const environment = {
      NODE_ENV: 'test',
      EXTERNAL_MODEL_CALLS_ENABLED: 'true',
    } as NodeJS.ProcessEnv;
    expect(
      isRuntimeCapabilityEnabled('EXTERNAL_MODEL_CALLS_ENABLED', environment)
    ).toBe(true);
    expect(() =>
      requireRuntimeCapability('EXTERNAL_MODEL_CALLS_ENABLED', environment)
    ).not.toThrow();
  });
});
