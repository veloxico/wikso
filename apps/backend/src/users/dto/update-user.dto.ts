import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const VALID_LOCALES = [
  'en', 'ru', 'uk', 'be', 'pl', 'es', 'esAR', 'pt', 'ptBR', 'zh',
] as const;

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  // avatarUrl is set only via the dedicated POST /users/me/avatar upload flow

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(VALID_LOCALES)
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;
}
