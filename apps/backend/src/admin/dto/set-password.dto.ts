import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;
}
