import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Body for the public content-fetch endpoint. `password` is optional because
 * non-gated shares do not need it; the service enforces presence when the
 * share actually requires a password.
 */
export class VerifySharePasswordDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 128 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password?: string;
}
