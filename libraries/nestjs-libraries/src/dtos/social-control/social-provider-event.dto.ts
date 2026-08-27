import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const SOCIAL_PROVIDER_EVENT_TYPES = [
  'social.provider.accepted',
  'social.post.published',
  'social.post.failed',
  'social.post.cancelled',
] as const;

export type SocialProviderEventType =
  (typeof SOCIAL_PROVIDER_EVENT_TYPES)[number];

class SocialProviderEventDataDto {
  @IsUUID()
  delivery_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  provider_post_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  error_code?: string;

  @IsOptional()
  @IsObject()
  provider_payload?: Record<string, unknown>;
}

export class SocialProviderEventDto {
  @IsString()
  @Length(8, 200)
  event_id!: string;

  @IsIn(SOCIAL_PROVIDER_EVENT_TYPES)
  event_type!: SocialProviderEventType;

  @IsIn(['1.0'])
  event_version!: '1.0';

  @IsDateString({ strict: true })
  occurred_at!: string;

  @ValidateNested()
  @Type(() => SocialProviderEventDataDto)
  data!: SocialProviderEventDataDto;
}
