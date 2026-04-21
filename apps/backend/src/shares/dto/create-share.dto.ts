import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShareDto {
  /** Optional ISO 8601 expiration — if omitted, the link lives until explicitly revoked. */
  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  /** Optional password gate. Hashed server-side with bcrypt, never stored in plaintext. */
  @ApiPropertyOptional({ minLength: 4, maxLength: 128 })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password?: string;

  /** Allow anonymous visitors to add footer comments (not inline). Default false. */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;
}
