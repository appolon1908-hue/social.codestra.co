import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SocialPublicationPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  content: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  media_ids: string[] = [];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class SocialPublicationTargetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  account_id: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  provider: string;

  @IsObject()
  settings: Record<string, unknown>;
}

export class SocialPublicationCommandDto {
  @IsString()
  @Matches(/^1\.0$/)
  command_version: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  requested_by: string;

  @IsISO8601()
  @IsOptional()
  schedule_at?: string;

  @ValidateNested()
  @Type(() => SocialPublicationPostDto)
  post: SocialPublicationPostDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SocialPublicationTargetDto)
  targets: SocialPublicationTargetDto[];
}
