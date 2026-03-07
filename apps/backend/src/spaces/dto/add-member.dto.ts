import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SpaceRole } from '@prisma/client';

export class AddMemberDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ enum: SpaceRole })
  @IsEnum(SpaceRole)
  role: SpaceRole;
}
