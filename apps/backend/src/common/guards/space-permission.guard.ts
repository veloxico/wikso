import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SpaceRole } from '@prisma/client';

@Injectable()
export class SpacePermissionGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const slug = request.params.slug;

    if (!slug || !user) return false;
    if (user.role === 'ADMIN') return true;

    const space = await this.prisma.space.findUnique({ where: { slug } });
    if (!space) return false;

    if (space.ownerId === user.id) return true;
    if (space.type === 'PUBLIC') return true;

    const perm = await this.prisma.spacePermission.findFirst({
      where: { spaceId: space.id, userId: user.id },
    });

    if (!perm) throw new ForbiddenException('No access to this space');
    request.spacePermission = perm;
    request.space = space;
    return true;
  }
}
