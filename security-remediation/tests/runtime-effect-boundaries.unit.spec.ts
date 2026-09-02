import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { StripeService } from '@gitroom/nestjs-libraries/services/stripe.service';

jest.mock('@gitroom/nestjs-libraries/openai/openai.service', () => ({
  OpenaiService: class {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service',
  () => ({ SubscriptionService: class {} })
);
jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: {
    createStorage: () => ({ uploadSimple: jest.fn() }),
  },
}));

describe('production effect boundaries', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      BILLING_LIVE_CHARGE: 'false',
      EXTERNAL_MODEL_CALLS_ENABLED: 'false',
      STRIPE_PUBLISHABLE_KEY: 'configured-for-unit-test',
    };
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('rejects video generation before credits or provider execution', async () => {
    const checkCredits = jest.fn();
    const process = jest.fn();
    const media = new MediaService(
      {} as never,
      {} as never,
      { checkCredits } as never,
      {
        getVideoByName: jest.fn(() => ({
          trial: false,
          instance: { process, processAndValidate: jest.fn() },
        })),
      } as never
    );

    await expect(
      media.generateVideo(
        { id: 'org-test', isTrailing: false } as never,
        { type: 'veo3', output: 'horizontal', customParams: {} } as never
      )
    ).rejects.toThrow('External model execution is disabled');
    expect(checkCredits).not.toHaveBeenCalled();
    expect(process).not.toHaveBeenCalled();
  });

  it('continues non-trial subscription ingestion while live billing is disabled', async () => {
    const getOrgByCustomerId = jest.fn().mockResolvedValue({
      allowTrial: false,
    });
    const stripe = new StripeService(
      {} as never,
      { getOrgByCustomerId } as never,
      {} as never,
      {} as never
    );

    await expect(
      stripe.checkValidCard({
        data: {
          object: { status: 'active', customer: 'cus_test' },
        },
      } as never)
    ).resolves.toBe(true);
    expect(getOrgByCustomerId).toHaveBeenCalledWith('cus_test');
  });

  it('keeps disabled post-swap Stripe synchronization a no-op', async () => {
    const getOrgsByUserId = jest.fn();
    const stripe = new StripeService(
      {} as never,
      { getOrgsByUserId } as never,
      {} as never,
      {} as never
    );

    await expect(
      stripe.syncCustomerEmailsAfterSwitch([
        { id: 'user-test', email: 'user@example.test' },
      ])
    ).resolves.toBeUndefined();
    expect(getOrgsByUserId).not.toHaveBeenCalled();
  });
});
