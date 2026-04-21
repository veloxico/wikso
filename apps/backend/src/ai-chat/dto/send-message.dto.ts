import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'The user question' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;
}
