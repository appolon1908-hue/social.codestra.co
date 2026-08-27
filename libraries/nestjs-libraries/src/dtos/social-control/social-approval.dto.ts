import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class SocialApprovalPolicyDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsArray() stages: Record<string, unknown>[];
}
export class SocialApprovalRequestDto {
  @IsString() policy_id: string;
  @IsString() resource_type: string;
  @IsString() resource_id: string;
  @IsString() revision_id: string;
  @IsString() submitted_by: string;
}
export class SocialApprovalDecisionDto {
  @IsString() actor: string;
  @IsString() @IsIn(['approve', 'reject', 'request_changes']) decision:
    | 'approve'
    | 'reject'
    | 'request_changes';
  @IsString() @IsOptional() @MaxLength(2000) comment?: string;
}
export class SocialExternalReviewTokenDto {
  @IsString() created_by: string;
  @IsInt() @Min(5) @Max(10080) expires_in_minutes: number;
  @IsInt() @Min(1) @Max(20) max_uses: number;
}
