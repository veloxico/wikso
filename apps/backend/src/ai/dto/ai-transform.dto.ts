import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AiOperation {
  EXPAND = 'expand',
  SUMMARIZE = 'summarize',
  FIX_GRAMMAR = 'fix-grammar',
  CHANGE_TONE = 'change-tone',
}

export class AiTransformDto {
  @ApiProperty({ description: 'ID of the page being edited' })
  @IsString()
  pageId: string;

  @ApiProperty({ description: 'Selected text to transform' })
  @IsString()
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
}
