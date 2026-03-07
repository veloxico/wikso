import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string) {
    try {
      const user = await this.authService.validateUser(email, password);
      if (!user) throw new UnauthorizedException('Invalid credentials');
      return user;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      // DB errors should not leak as 500
      throw new UnauthorizedException('Authentication temporarily unavailable');
    }
  }
}
