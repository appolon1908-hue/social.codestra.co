import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const SAAS_PLAN_CODES = [
  'starter',
  'professional',
  'agency',
  'enterprise',
] as const;
export const SAAS_SUBSCRIPTION_STATES = [
  'trialing',
  'active',
  'past_due',
  'grace',
  'paused',
  'cancel_at_period_end',
  'canceled',
  'incomplete',
] as const;

export class SocialBillingEventDto {
  @IsString()
  @Matches(/^2\.0$/)
  event_version: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  provider_event_id: string;

  @IsString()
  @IsIn([
    'subscription.created',
    'subscription.updated',
    'subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed',
  ])
  event_type: string;

  @IsISO8601()
  occurred_at: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  customer_id: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subscription_id: string;

  @IsString()
  @IsIn(SAAS_PLAN_CODES)
  plan_code: (typeof SAAS_PLAN_CODES)[number];

  @IsString()
  @Matches(/^2026-08-v1$/)
  catalog_version: string;

  @IsString()
  @IsIn(['monthly', 'yearly'])
  period: 'monthly' | 'yearly';

  @IsInt()
  @Min(1)
  @Max(10000)
  seat_quantity: number;

  @IsString()
  @IsIn(SAAS_SUBSCRIPTION_STATES)
  status: (typeof SAAS_SUBSCRIPTION_STATES)[number];

  @IsISO8601()
  current_period_start: string;

  @IsISO8601()
  current_period_end: string;

  @IsBoolean()
  cancel_at_period_end: boolean;

  @IsISO8601()
  @IsOptional()
  grace_until?: string;

  @IsObject()
  entitlements: Record<string, unknown>;
}
