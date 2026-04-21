import { IsArray, IsIn, IsString, ArrayMinSize, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const SLACK_PAGE_EVENTS = ['page.created', 'page.updated', 'page.deleted'] as const;
export type SlackPageEvent = (typeof SLACK_PAGE_EVENTS)[number];

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'C0123456789' })
  @IsString()
  slackChannelId: string;

  @ApiProperty({ example: 'general' })
  @IsString()
  slackChannelName: string;

  @ApiProperty({ example: '3b41f6d1-e3fe-4f32-a43f-1f3e1a4f99bd' })
  @IsString()
  spaceId: string;

  @ApiProperty({
    example: ['page.created', 'page.updated'],
    isArray: true,
    enum: SLACK_PAGE_EVENTS,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsIn(SLACK_PAGE_EVENTS as unknown as string[], { each: true })
  eventTypes: SlackPageEvent[];
}
