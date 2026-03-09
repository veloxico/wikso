import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({ example: 'documentation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
