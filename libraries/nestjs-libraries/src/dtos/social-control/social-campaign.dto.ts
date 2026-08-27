import {
  IsArray,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
export class SocialCampaignCreateDto {
  @IsString() @MinLength(2) @MaxLength(160) name: string;
  @IsString() objective: string;
  @IsString() owner_id: string;
  @IsString() timezone: string;
  @IsISO8601() starts_at: string;
  @IsISO8601() ends_at: string;
  @IsString() @IsOptional() brand_id?: string;
  @IsObject() budget: Record<string, unknown>;
}
export class SocialCampaignItemDto {
  @IsString() content_revision_id: string;
  @IsString() @IsOptional() approval_request_id?: string;
  @IsISO8601() scheduled_at: string;
  @IsString() timezone: string;
  @IsArray() targets: Record<string, unknown>[];
}
