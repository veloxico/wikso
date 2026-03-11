import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddGroupMemberDto {
  @ApiProperty()
  @IsString()
  userId: string;
}
