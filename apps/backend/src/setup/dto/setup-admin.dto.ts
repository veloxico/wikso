import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetupAdminDto {
  @ApiProperty({ example: 'admin@veloxico.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'StrongPassword123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'My Wikso', description: 'Instance name (optional)' })
  @IsOptional()
  @IsString()
  instanceName?: string;
}
