import { Controller, Get, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SetupService } from './setup.service';
import { SetupAdminDto } from './dto/setup-admin.dto';
import { TestDbDto } from './dto/test-db.dto';
import { SaveDbDto } from './dto/save-db.dto';

@ApiTags('Setup')
@Controller('setup')
export class SetupController {
  private readonly logger = new Logger(SetupController.name);

  constructor(private setupService: SetupService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Check setup progress',
    description:
      'Returns current setup stage: database (need DB config), admin (need admin user), or complete.',
  })
  getStatus() {
    return this.setupService.getStatus();
  }

  @Post('test-db')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Test a PostgreSQL connection',
    description:
      'Attempts a one-off connection using the given URL. Does not persist anything.',
  })
  testDatabase(@Body() dto: TestDbDto) {
    return this.setupService.testDatabase(dto);
  }

  @Post('save-db')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Persist DB config + run migrations',
    description:
      'Writes the connection to the runtime config volume, runs Prisma migrations, and signals the frontend to wait for restart. Only available during setup.',
  })
  async saveDatabase(@Body() dto: SaveDbDto) {
    const result = await this.setupService.saveDatabase(dto);

    // If restart is required, schedule process exit after the response is sent.
    // Docker's restart policy will bring the container back up with the new config.
    if (result.requiresRestart) {
      setTimeout(() => {
        this.logger.log('Restarting process to apply new database config...');
        process.exit(0);
      }, 500);
    }

    return result;
  }

  @Post('init')
  @ApiOperation({
    summary: 'Create first admin user',
    description:
      'Only works when zero users exist in DB. Creates admin + default space + marks setup complete.',
  })
  createAdmin(@Body() dto: SetupAdminDto) {
    return this.setupService.createAdmin(dto);
  }
}
