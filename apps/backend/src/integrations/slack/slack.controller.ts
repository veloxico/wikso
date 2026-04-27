import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GlobalRole } from '@prisma/client';
import { SlackService } from './slack.service';
import type { SlackEventBody } from './slack.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@ApiTags('Slack Integration')
@Controller('integrations/slack')
export class SlackController {
  constructor(private readonly slackService: SlackService) {}

  // ─── OAuth (admin-only start, public callback) ─────────

  @Get('config-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Report whether Slack env vars are configured (lets the UI show setup guidance instead of failing on Connect)',
  })
  getConfigStatus() {
    return this.slackService.getConfigStatus();
  }

  @Post('oauth/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start Slack OAuth install flow' })
  async startOAuth(@Req() req: any) {
    return this.slackService.startOAuth(req.user.id);
  }

  @Get('oauth/callback')
  @ApiOperation({ summary: 'Slack OAuth callback — redirects back to the admin UI' })
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const { redirectUrl } = await this.slackService.handleOAuthCallback(code, state);
    return res.redirect(redirectUrl);
  }

  // ─── Slack Events API webhook (public, signature-verified) ─

  @Post('events')
  @HttpCode(200)
  @ApiOperation({ summary: 'Slack Events API webhook' })
  async events(
    @Req() req: any,
    @Headers('x-slack-signature') signature: string,
    @Headers('x-slack-request-timestamp') timestamp: string,
    @Body() body: SlackEventBody,
  ) {
    const raw = req.rawBody?.toString('utf8');
    if (!raw) throw new UnauthorizedException('Missing raw body');
    const ok = this.slackService.verifySlackSignature(raw, timestamp, signature);
    if (!ok) throw new UnauthorizedException('Invalid Slack signature');
    return this.slackService.handleEvent(body);
  }

  // ─── Admin-only workspace management ───────────────────

  @Get('workspace')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get currently connected Slack workspace' })
  getWorkspace() {
    return this.slackService.getWorkspace();
  }

  @Delete('workspace')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect the Slack workspace' })
  disconnect() {
    return this.slackService.disconnectWorkspace();
  }

  @Get('channels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List Slack channels available to the bot' })
  listChannels() {
    return this.slackService.listChannels();
  }

  @Get('subscriptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List Slack channel subscriptions' })
  listSubscriptions() {
    return this.slackService.listSubscriptions();
  }

  @Post('subscriptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subscribe a Slack channel to events from a Wikso space' })
  subscribe(@Body() dto: CreateSubscriptionDto) {
    return this.slackService.subscribeChannel(
      dto.slackChannelId,
      dto.slackChannelName,
      dto.spaceId,
      dto.eventTypes,
    );
  }

  @Delete('subscriptions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a Slack channel subscription' })
  unsubscribe(@Param('id') id: string) {
    return this.slackService.unsubscribeChannel(id);
  }
}
