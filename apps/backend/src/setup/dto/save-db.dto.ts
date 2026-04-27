import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Persist a PostgreSQL connection for the Wikso instance.
 * Same shape as TestDbDto but used in a different endpoint with stronger
 * side-effects (writes config file + runs migrations).
 */
export class SaveDbDto {
  @ApiProperty({
    example: 'postgresql://postgres:password@postgres:5432/wikso',
    description: 'PostgreSQL connection URL to persist',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @Matches(/^postgres(ql)?:\/\//, {
    message: 'databaseUrl must be a valid PostgreSQL connection string (postgresql://...)',
  })
  databaseUrl: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  useTls?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  rejectUnauthorized?: boolean;
}
