import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { requireSecret } from '../../common/utils/secrets';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Hard-fail at boot if JWT_SECRET is unset / placeholder / too short.
      // Better than silently signing tokens with a guessable key.
      secretOrKey: requireSecret('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    try {
      const user = await this.usersService.findById(payload.sub);
      if ((user as any).status === 'SUSPENDED') {
        throw new ForbiddenException('Your account has been suspended');
      }
      return user;
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new UnauthorizedException();
    }
  }
}
