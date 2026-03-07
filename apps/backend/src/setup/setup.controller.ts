import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SetupService } from './setup.service';
import { SetupAdminDto } from './dto/setup-admin.dto';

@ApiTags('Setup')
@Controller('setup')
export class SetupController {
  constructor(private setupService: SetupService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Check if initial setup is required',
    description:
      'Returns { setupRequired: true } when no users exist. Frontend should redirect to setup wizard when setupRequired=true.',
  })
  getStatus() {
    return this.setupService.getStatus();
  }

  @Post('init')
  @ApiOperation({
    summary: 'Create first admin user (setup wizard)',
    description:
      'Only works when zero users exist in DB. Creates admin user + default "General" space. Returns 403 if setup already completed.',
  })
  createAdmin(@Body() dto: SetupAdminDto) {
    return this.setupService.createAdmin(dto);
  }
}
