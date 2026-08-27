import {
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
export class SocialEngagementIngestDto {
  @IsString() provider_event_id: string;
  @IsString() provider: string;
  @IsString() account_id: string;
  @IsString()
  @IsIn(['comment', 'mention', 'review', 'message_reference'])
  kind: string;
  @IsObject() external_author: Record<string, unknown>;
  @IsString() content: string;
  @IsISO8601() occurred_at: string;
  @IsString() @IsOptional() sentiment?: string;
  @IsInt() @Min(1) @Max(5) priority: number;
  @IsISO8601() @IsOptional() sla_due_at?: string;
}
export class SocialEngagementAssignDto {
  @IsString() actor: string;
  @IsString() assigned_to: string;
}
export class SocialEngagementEscalateDto {
  @IsString() actor: string;
  @IsString() reason: string;
}
