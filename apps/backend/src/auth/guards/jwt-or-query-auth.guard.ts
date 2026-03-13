import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';

/**
 * Auth guard that accepts JWT from:
 * 1. Authorization: Bearer <token> header (standard)
 * 2. ?token=<jwt> query parameter (for <img src>, <video src>, etc.)
 *
 * This allows protected endpoints to work with browser-initiated
 * requests (images, downloads) where custom headers cannot be set.
 */
@Injectable()
export class JwtOrQueryAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Try Authorization header first
    let token: string | undefined;
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    // Fall back to query parameter
    if (!token) {
      token = request.query?.token;
    }

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findById(payload.sub);
      if ((user as any).status === 'SUSPENDED') {
        throw new ForbiddenException('Your account has been suspended');
      }
      request.user = user;
      return true;
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
