import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveEmailConfigDto {
  @ApiProperty({ description: 'Email provider type', example: 'smtp' })
  @IsString()
  provider: string;

  @ApiProperty({ description: 'Provider-specific configuration', example: { host: 'smtp.gmail.com', port: 587 } })
  @IsObject()
  config: Record<string, any>;

  @ApiPropertyOptional({ description: 'From email address', example: 'noreply@example.com' })
  @IsOptional()
  @IsString()
  fromAddress?: string;

  @ApiPropertyOptional({ description: 'From display name', example: 'Wikso' })
  @IsOptional()
  @IsString()
  fromName?: string;
}
