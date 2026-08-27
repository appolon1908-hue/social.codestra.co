import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SocialBrandCreateDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsString() @MinLength(1) @MaxLength(200) requested_by: string;
  @IsObject() voice: Record<string, unknown>;
  @IsObject() audience: Record<string, unknown>;
  @IsObject() visual_rules: Record<string, unknown>;
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  prohibited_topics: string[];
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  prohibited_claims: string[];
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  required_disclaimers: string[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  locales: string[];
}

export class SocialAiGenerationRequestDto {
  @IsString() @MinLength(1) @MaxLength(200) requested_by: string;
  @IsString() @MinLength(1) @MaxLength(200) brand_revision_id: string;
  @IsString() @MinLength(2) @MaxLength(500) objective: string;
  @IsString() @MinLength(2) @MaxLength(10000) prompt: string;
  @IsArray() @ArrayMaxSize(50) sources: Record<string, unknown>[];
  @IsObject() model_policy: Record<string, unknown>;
}
