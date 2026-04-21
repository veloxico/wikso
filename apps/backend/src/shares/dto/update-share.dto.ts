import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Partial updates to an existing share. Fields left undefined are left unchanged.
 *
 * Password semantics:
 *   - `password: "<plaintext>"` → hash and set
 *   - `password: null`          → clear the password requirement
 *   - `password` undefined      → leave the hash untouched
 */
export class UpdateShareDto {
  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z', nullable: true })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;

  @ApiPropertyOptional({ minLength: 4, maxLength: 128, nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;
}
