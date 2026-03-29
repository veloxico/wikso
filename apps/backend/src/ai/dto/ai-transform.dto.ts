import {
  IsString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AiOperation {
  EXPAND = 'expand',
  SUMMARIZE = 'summarize',
  FIX_GRAMMAR = 'fix-grammar',
  CHANGE_TONE = 'change-tone',
  CUSTOM_PROMPT = 'custom-prompt',
}

export class AiTransformDto {
  @ApiProperty({ description: 'ID of the page being edited' })
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @ApiProperty({ description: 'Selected text to transform' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  selection: string;

  @ApiProperty({ enum: AiOperation, description: 'Transform operation' })
  @IsEnum(AiOperation)
  operation: AiOperation;

  @ApiPropertyOptional({ description: 'Surrounding paragraph context' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  context?: string;

  @ApiPropertyOptional({ description: 'Custom prompt for custom-prompt operation' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customPrompt?: string;
}
