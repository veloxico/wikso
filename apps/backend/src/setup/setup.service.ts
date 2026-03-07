import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GlobalRole } from '@prisma/client';
import { SetupAdminDto } from './dto/setup-admin.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SetupService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if initial setup is needed (no users exist yet)
   */
  async getStatus(): Promise<{ setupRequired: boolean; userCount: number }> {
    const userCount = await this.prisma.user.count();
    return {
      setupRequired: userCount === 0,
      userCount,
    };
  }

  /**
   * Create the first admin user. Only works when DB has zero users.
   */
  async createAdmin(dto: SetupAdminDto) {
    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      throw new ForbiddenException(
        'Setup already completed. At least one user exists.',
      );
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const admin = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        emailVerified: true,
        role: GlobalRole.ADMIN,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Create a default "General" space owned by admin
    await this.prisma.space.create({
      data: {
        name: dto.instanceName || 'General',
        slug: 'general',
        description: 'Default space',
        type: 'PUBLIC',
        ownerId: admin.id,
      },
    });

    return {
      message: 'Setup complete. Admin user created.',
      user: admin,
    };
  }
}
