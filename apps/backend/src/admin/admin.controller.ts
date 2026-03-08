import { Controller, Get, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GlobalRole } from '@prisma/client';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UpdateRoleDto } from '../users/dto/update-role.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  getUsers(@Query('skip') skip?: number, @Query('take') take?: number) {
    return this.adminService.getUsers(Number(skip) || 0, Number(take) || 20);
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

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user' })
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('audit-log')
  @ApiOperation({ summary: 'Get audit logs' })
  getAuditLog(@Query('skip') skip?: number, @Query('take') take?: number) {
    return this.adminService.getAuditLog(Number(skip) || 0, Number(take) || 50);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system stats' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('auth-providers')
  @ApiOperation({ summary: 'Get authentication provider configuration status' })
  getAuthProviders() {
    return this.adminService.getAuthProviders();
  }
}
