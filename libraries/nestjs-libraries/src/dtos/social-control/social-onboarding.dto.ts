import {
  IsIn,
  IsObject,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const SOCIAL_ONBOARDING_STATES = [
  'identity_verified',
  'workspace_configured',
  'brand_ready',
  'accounts_connected',
  'policy_ready',
  'dry_run_passed',
  'ready_for_activation',
] as const;

export type SocialOnboardingStateInput =
  (typeof SOCIAL_ONBOARDING_STATES)[number];

export class SocialOnboardingTransitionDto {
  @IsString()
  @IsIn(SOCIAL_ONBOARDING_STATES)
  to_state: SocialOnboardingStateInput;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  requested_by: string;

  @IsObject()
  evidence: Record<string, unknown>;
}
