import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { GlobalRole } from '@prisma/client';

export class UpdateRoleDto {
  @ApiProperty({ enum: GlobalRole })
  @IsEnum(GlobalRole)
  role: GlobalRole;
}
