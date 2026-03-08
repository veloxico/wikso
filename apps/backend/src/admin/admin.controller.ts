import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { SettingsService } from '../settings/settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GlobalRole } from '@prisma/client';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UpdateRoleDto } from '../users/dto/update-role.dto';
import { UpdateSettingsDto } from '../settings/dto/update-settings.dto';
import { InviteUserDto, BulkInviteDto } from './dto/invite-user.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private settingsService: SettingsService,
  ) {}

  // ─── Settings ──────────────────────────────────────────

  @Get('settings')
  @ApiOperation({ summary: 'Get system settings' })
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update system settings' })
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }

  // ─── Users ─────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List all users (with search/filter)' })
  getUsers(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getUsers(
      Number(skip) || 0,
      Number(take) || 20,
      search,
      role,
      status,
    );
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user (admin)' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  updateUserRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.adminService.updateUser(id, { role: dto.role });
  }

  @Patch('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend user account' })
  suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Patch('users/:id/activate')
  @ApiOperation({ summary: 'Activate user account' })
  activateUser(@Param('id') id: string) {
    return this.adminService.activateUser(id);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user' })
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Post('users/invite')
  @ApiOperation({ summary: 'Invite a user by email' })
  inviteUser(@Body() dto: InviteUserDto, @Req() req: any) {
    return this.adminService.inviteUser(
      dto.email,
      dto.role || GlobalRole.VIEWER,
      dto.name,
      req.user.id,
    );
  }

  @Post('users/invite/bulk')
  @ApiOperation({ summary: 'Bulk invite users by email' })
  bulkInvite(@Body() dto: BulkInviteDto, @Req() req: any) {
    return this.adminService.bulkInvite(
      dto.emails,
      dto.role || GlobalRole.VIEWER,
      req.user.id,
    );
  }

  // ─── Spaces ────────────────────────────────────────────

  @Get('spaces')
  @ApiOperation({ summary: 'List all spaces (admin)' })
  getSpaces(@Query('skip') skip?: number, @Query('take') take?: number) {
    return this.adminService.getSpaces(Number(skip) || 0, Number(take) || 20);
  }

  @Patch('spaces/:id')
  @ApiOperation({ summary: 'Update space (admin)' })
  updateSpace(@Param('id') id: string, @Body() body: { type?: string }) {
    return this.adminService.updateSpace(id, body);
  }

  @Delete('spaces/:id')
  @ApiOperation({ summary: 'Delete space (admin)' })
  deleteSpace(@Param('id') id: string) {
    return this.adminService.deleteSpace(id);
  }

  // ─── Audit Log ─────────────────────────────────────────

  @Get('audit-log')
  @ApiOperation({ summary: 'Get audit logs (with filters)' })
  getAuditLog(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAuditLog(
      Number(skip) || 0,
      Number(take) || 50,
      { action, userId, from, to, search },
    );
  }

  // ─── Stats ─────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get system stats' })
  getStats() {
    return this.adminService.getStats();
  }

  // ─── Auth Providers ────────────────────────────────────

  @Get('auth-providers')
  @ApiOperation({ summary: 'Get authentication provider configuration status' })
  getAuthProviders() {
    return this.adminService.getAuthProviders();
  }

  // ─── Email ─────────────────────────────────────────────

  @Get('email/status')
  @ApiOperation({ summary: 'Get SMTP email configuration status' })
  getEmailStatus() {
    return this.adminService.getEmailStatus();
  }

  @Post('email/test')
  @ApiOperation({ summary: 'Send test email to admin' })
  sendTestEmail(@Req() req: any) {
    return this.adminService.sendTestEmail(req.user.email);
  }

  // ─── Webhooks ──────────────────────────────────────────

  @Get('webhooks')
  @ApiOperation({ summary: 'List all webhooks (admin)' })
  getWebhooks(@Query('skip') skip?: number, @Query('take') take?: number) {
    return this.adminService.getWebhooks(Number(skip) || 0, Number(take) || 20);
  }

  @Patch('webhooks/:id')
  @ApiOperation({ summary: 'Toggle webhook active state' })
  toggleWebhook(@Param('id') id: string, @Body() body: { active: boolean }) {
    return this.adminService.toggleWebhook(id, body.active);
  }
}
