import { IsString, IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SpaceRole } from '@prisma/client';

export class AddMemberDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiProperty({ enum: SpaceRole })
  @IsEnum(SpaceRole)
  role: SpaceRole;
}
