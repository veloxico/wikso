import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateWebhookDto } from './dto/create-webhook.dto';

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: 'Create webhook' })
  create(@Body() dto: CreateWebhookDto, @CurrentUser() user: any) {
    return this.webhooksService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List webhooks' })
  findAll(@CurrentUser() user: any) {
    return this.webhooksService.findAll(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete webhook' })
  remove(@Param('id') id: string) {
    return this.webhooksService.delete(id);
  }
}
