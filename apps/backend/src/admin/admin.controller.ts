import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { SettingsService } from '../settings/settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GlobalRole, SpaceType } from '@prisma/client';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UpdateRoleDto } from '../users/dto/update-role.dto';
import { UpdateSettingsDto } from '../settings/dto/update-settings.dto';
import { InviteUserDto, BulkInviteDto } from './dto/invite-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { SaveEmailConfigDto } from './dto/email-config.dto';

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
  async getSettings() {
    const settings = await this.settingsService.getSettings();
    // Strip encrypted email provider credentials from the response.
    // Email config should only be accessed via GET /admin/email/config (with masking).
    const { emailProviderConfig, ...safeSettings } = settings;
    return safeSettings;
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update system settings' })
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    const settings = await this.settingsService.updateSettings(dto);
    const { emailProviderConfig, ...safeSettings } = settings;
    return safeSettings;
  }

  // ─── Users ─────────────────────────────────────────────

  @Post('users')
  @ApiOperation({ summary: 'Create a local user' })
  createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createUser(dto.email, dto.name, dto.password, dto.role);
  }

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
      Math.max(Number(skip) || 0, 0),
      Math.min(Math.max(Number(take) || 20, 1), 100),
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

  @Patch('users/:id/password')
  @ApiOperation({ summary: 'Set password for a user' })
  setPassword(@Param('id') id: string, @Body() dto: SetPasswordDto) {
    return this.adminService.setPassword(id, dto.password);
  }

  @Patch('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend user account' })
  suspendUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.suspendUser(id, req.user.id);
  }

  @Patch('users/:id/activate')
  @ApiOperation({ summary: 'Activate user account' })
  activateUser(@Param('id') id: string) {
    return this.adminService.activateUser(id);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user' })
  deleteUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.deleteUser(id, req.user.id);
  }

  @Post('users/invite')
  @ApiOperation({ summary: 'Invite a user by email' })
  inviteUser(@Body() dto: InviteUserDto, @Req() req: any) {
    return this.adminService.inviteUser(
      dto.email,
      dto.role || GlobalRole.USER,
      dto.name,
      req.user.id,
    );
  }

  @Post('users/invite/bulk')
  @ApiOperation({ summary: 'Bulk invite users by email' })
  bulkInvite(@Body() dto: BulkInviteDto, @Req() req: any) {
    return this.adminService.bulkInvite(
      dto.emails,
      dto.role || GlobalRole.USER,
      req.user.id,
    );
  }

  @Post('users/bulk-suspend')
  @ApiOperation({ summary: 'Bulk suspend users' })
  bulkSuspendUsers(@Body() body: { userIds: string[] }, @Req() req: any) {
    return this.adminService.bulkSuspendUsers(body.userIds, req.user.id);
  }

  @Post('users/bulk-delete')
  @ApiOperation({ summary: 'Bulk delete users' })
  bulkDeleteUsers(@Body() body: { userIds: string[] }, @Req() req: any) {
    return this.adminService.bulkDeleteUsers(body.userIds, req.user.id);
  }

  // ─── Spaces ────────────────────────────────────────────

  @Get('spaces')
  @ApiOperation({ summary: 'List all spaces (admin)' })
  getSpaces(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    return this.adminService.getSpaces(Number(skip) || 0, Number(take) || 20, search, type as SpaceType);
  }

  @Patch('spaces/:id')
  @ApiOperation({ summary: 'Update space (admin)' })
  updateSpace(@Param('id') id: string, @Body() body: { name?: string; description?: string; type?: string; ownerId?: string }) {
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

  @Get('stats/activity')
  @ApiOperation({ summary: 'Get activity stats with configurable time range' })
  getActivityStats(@Query('period') period?: string) {
    return this.adminService.getActivityStats(period);
  }

  // ─── Auth Providers ────────────────────────────────────

  @Get('auth-providers')
  @ApiOperation({ summary: 'Get authentication provider configuration status' })
  getAuthProviders() {
    return this.adminService.getAuthProviders();
  }

  // ─── Email ─────────────────────────────────────────────

  @Get('email/status')
  @ApiOperation({ summary: 'Get email configuration status' })
  getEmailStatus() {
    return this.adminService.getEmailStatus();
  }

  @Get('email/providers')
  @ApiOperation({ summary: 'List available email providers with field definitions' })
  getEmailProviders() {
    return this.adminService.getEmailProviders();
  }

  @Get('email/config')
  @ApiOperation({ summary: 'Get current email provider configuration (secrets masked)' })
  getEmailConfig() {
    return this.adminService.getEmailConfig();
  }

  @Put('email/config')
  @ApiOperation({ summary: 'Save email provider configuration' })
  saveEmailConfig(@Body() dto: SaveEmailConfigDto) {
    return this.adminService.saveEmailConfig(dto);
  }

  @Delete('email/config')
  @ApiOperation({ summary: 'Clear email provider configuration (revert to env vars)' })
  deleteEmailConfig() {
    return this.adminService.deleteEmailConfig();
  }

  @Post('email/test')
  @ApiOperation({ summary: 'Send test email to admin' })
  sendTestEmail(@Req() req: any) {
    return this.adminService.sendTestEmail(req.user.email);
  }

  // ─── Trash ───────────────────────────────────────────────

  @Get('trash')
  @ApiOperation({ summary: 'List all trashed pages across all spaces' })
  getTrash(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('search') search?: string,
    @Query('spaceId') spaceId?: string,
  ) {
    return this.adminService.getTrash(Number(skip) || 0, Number(take) || 20, search, spaceId);
  }

  @Post('trash/:pageId/restore')
  @ApiOperation({ summary: 'Restore a trashed page' })
  restorePage(@Param('pageId') pageId: string) {
    return this.adminService.restorePage(pageId);
  }

  @Post('trash/bulk-restore')
  @ApiOperation({ summary: 'Bulk restore trashed pages' })
  bulkRestorePages(@Body() body: { pageIds: string[] }) {
    return this.adminService.bulkRestorePages(body.pageIds);
  }

  @Post('trash/bulk-delete')
  @ApiOperation({ summary: 'Bulk permanently delete trashed pages' })
  bulkDeletePages(@Body() body: { pageIds: string[] }) {
    return this.adminService.bulkPermanentDeletePages(body.pageIds);
  }

  @Delete('trash/:pageId')
  @ApiOperation({ summary: 'Permanently delete a trashed page' })
  permanentDeletePage(@Param('pageId') pageId: string) {
    return this.adminService.permanentDeletePage(pageId);
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

  @Post('webhooks')
  @ApiOperation({ summary: 'Create a webhook' })
  createWebhook(@Body() body: { url: string; events: string[]; secret?: string }, @Req() req: any) {
    return this.adminService.createWebhook({ ...body, userId: req.user.id });
  }

  @Put('webhooks/:id')
  @ApiOperation({ summary: 'Update a webhook' })
  updateWebhook(
    @Param('id') id: string,
    @Body() body: { url?: string; events?: string[]; secret?: string; active?: boolean },
  ) {
    return this.adminService.updateWebhook(id, body);
  }

  @Delete('webhooks/:id')
  @ApiOperation({ summary: 'Delete a webhook' })
  deleteWebhook(@Param('id') id: string) {
    return this.adminService.deleteWebhook(id);
  }
}
