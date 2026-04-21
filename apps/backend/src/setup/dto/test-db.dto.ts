import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TestDbDto {
  @ApiProperty({
    example: 'postgresql://postgres:password@postgres:5432/wikso',
    description: 'Full PostgreSQL connection URL',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @Matches(/^postgres(ql)?:\/\//, {
    message: 'databaseUrl must be a valid PostgreSQL connection string (postgresql://...)',
  })
  databaseUrl: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Enable TLS/SSL connection',
  })
  @IsOptional()
  @IsBoolean()
  useTls?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Reject unauthorized TLS certificates (set false for self-signed)',
  })
  @IsOptional()
  @IsBoolean()
  rejectUnauthorized?: boolean;
}
