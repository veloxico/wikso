import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from '@node-saml/passport-saml';
import { AuthService } from '../auth.service';

// passport-saml v5 has strict constructor overloads that conflict with
// @nestjs/passport's PassportStrategy mixin. Cast Strategy to any to workaround.
const SamlBase: any = Strategy;

@Injectable()
export class SamlStrategy extends PassportStrategy(SamlBase, 'saml') {
  constructor(private authService: AuthService) {
    const cert = (process.env.SAML_CERT || '').replace(/\\n/g, '\n');

    super({
      entryPoint: process.env.SAML_ENTRY_POINT || '',
      issuer: process.env.SAML_ISSUER || 'wikso',
      callbackUrl: process.env.SAML_CALLBACK_URL || '',
      cert: cert || undefined,
      wantAuthnResponseSigned: true,
      wantAssertionsSigned: false,
    });
  }

  async validate(profile: any, done: (err: any, user?: any) => void) {
    try {
      // SAML profiles vary by IdP — handle common claim schemas
      const email: string =
        profile.email ||
        profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
        profile['http://schemas.xmlsoap.org/claims/EmailAddress'] ||
        profile.nameID ||
        '';

      const name: string =
        profile.displayName ||
        profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
        profile['http://schemas.xmlsoap.org/claims/CommonName'] ||
        profile.firstName ||
        (email ? email.split('@')[0] : 'User');

      if (!email) {
        return done(new Error('SAML assertion missing email claim'));
      }

      const providerAccountId: string = profile.nameID || email;

      const user = await this.authService.validateOAuthUser({
        provider: 'saml',
        providerAccountId,
        email,
        name,
      });

      done(null, user);
    } catch (err) {
      done(err);
    }
  }
}
