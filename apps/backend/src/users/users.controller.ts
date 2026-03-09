import {
  Controller, Get, Post, Patch, Param, Body, Res,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Readable } from 'stream';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@CurrentUser() user: any, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser?.passwordHash) throw new BadRequestException('Account has no password set');

    const isMatch = await bcrypt.compare(body.currentPassword, dbUser.passwordHash);
    if (!isMatch) throw new BadRequestException('Current password is incorrect');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(body.newPassword, salt);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return { message: 'Password changed successfully' };
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload avatar image (max 5 MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: MAX_AVATAR_SIZE } }))
  async uploadAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, WebP and GIF images are allowed');
    }
    if (file.size > MAX_AVATAR_SIZE) {
      throw new BadRequestException('File size exceeds 5 MB limit');
    }
    return this.usersService.uploadAvatar(user.id, file);
  }

  @Get(':id/avatar')
  @ApiOperation({ summary: 'Stream user avatar (permanent URL)' })
  async getAvatar(@Param('id') id: string, @Res() res: any) {
    const result = await this.usersService.getAvatarStream(id);
    if (!result) {
      res.status(404).send('No avatar');
      return;
    }

    res.set({
      'Content-Type': result.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    if (result.stream instanceof Readable) {
      result.stream.pipe(res);
    } else if (result.stream && typeof (result.stream as any).transformToByteArray === 'function') {
      const bytes = await (result.stream as any).transformToByteArray();
      res.send(Buffer.from(bytes));
    } else {
      res.status(404).send('Avatar not found');
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID' })
  getUser(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
