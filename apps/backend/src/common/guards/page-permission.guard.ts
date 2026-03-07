import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PagePermissionGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const pageId = request.params.pageId;

    if (!pageId || !user) return false;
    if (user.role === 'ADMIN') return true;

    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: { space: true },
    });
    if (!page) return false;

    if (page.authorId === user.id) return true;
    if (page.space.type === 'PUBLIC') return true;

    const perm = await this.prisma.pagePermission.findFirst({
      where: { pageId, userId: user.id },
    });
    if (!perm) {
      const spacePerm = await this.prisma.spacePermission.findFirst({
        where: { spaceId: page.spaceId, userId: user.id },
      });
      if (!spacePerm) throw new ForbiddenException('No access to this page');
    }

    request.page = page;
    return true;
  }
}
