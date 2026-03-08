import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { MailModule } from '../mail/mail.module';

const optionalProviders: any[] = [];

// Only register OAuth strategies if credentials are configured
if (process.env.GOOGLE_CLIENT_ID) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleStrategy } = require('./strategies/google.strategy');
  optionalProviders.push(GoogleStrategy);
}
if (process.env.GITHUB_CLIENT_ID) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GitHubStrategy } = require('./strategies/github.strategy');
  optionalProviders.push(GitHubStrategy);
}
if (process.env.SAML_ENTRY_POINT) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SamlStrategy } = require('./strategies/saml.strategy');
  optionalProviders.push(SamlStrategy);
}

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any },
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy, ...optionalProviders],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
