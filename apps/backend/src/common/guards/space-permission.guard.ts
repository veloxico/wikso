import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SpaceRole } from '@prisma/client';

/** HTTP methods considered read-only (safe for public access). */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class SpacePermissionGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const slug = request.params.slug;

    if (!slug || !user) return false;

    // Global admin bypasses all checks
    if (user.role === 'ADMIN') return true;

    const space = await this.prisma.space.findUnique({ where: { slug } });
    if (!space) return false;

    request.space = space;

    // Owner has full access
    if (space.ownerId === user.id) return true;

    const isReadOnly = READ_METHODS.has(request.method);

    // Public spaces: grant read-only access to any authenticated user.
    // Write operations still require an explicit permission record.
    if (space.type === 'PUBLIC' && isReadOnly) return true;

    // Check explicit space permission (direct user or via group membership)
    const perm = await this.prisma.spacePermission.findFirst({
      where: {
        spaceId: space.id,
        OR: [
          { userId: user.id },
          { group: { members: { some: { userId: user.id } } } },
        ],
      },
    });

    if (!perm) throw new ForbiddenException('No access to this space');

    // VIEWER / GUEST roles only get read access
    if ((perm.role === SpaceRole.VIEWER || perm.role === SpaceRole.GUEST) && !isReadOnly) {
      throw new ForbiddenException('Insufficient permissions for this operation');
    }

    request.spacePermission = perm;
    return true;
  }
}
