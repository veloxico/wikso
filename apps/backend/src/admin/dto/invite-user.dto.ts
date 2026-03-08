import { IsEmail, IsOptional, IsString, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GlobalRole } from '@prisma/client';

export class InviteUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: GlobalRole })
  @IsOptional()
  @IsEnum(GlobalRole)
  role?: GlobalRole;
}

export class BulkInviteDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsEmail({}, { each: true })
  emails: string[];

  @ApiPropertyOptional({ enum: GlobalRole })
  @IsOptional()
  @IsEnum(GlobalRole)
  role?: GlobalRole;
}
