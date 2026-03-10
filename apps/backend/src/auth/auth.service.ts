import { Injectable, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { SettingsService } from '../settings/settings.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { RegisterDto } from './dto/register.dto';

const RESET_TOKEN_PREFIX = 'auth:reset:';
const VERIFY_TOKEN_PREFIX = 'auth:verify:';
const INVITE_TOKEN_PREFIX = 'auth:invite:';
const RESET_TOKEN_TTL = 3600; // 1 hour
const VERIFY_TOKEN_TTL = 86400; // 24 hours
const INVITE_TOKEN_TTL = 7 * 86400; // 7 days

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    private prisma: PrismaService,
    private redis: RedisService,
    private settingsService: SettingsService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if registration is enabled
    const isEnabled = await this.settingsService.isRegistrationEnabled();
    if (!isEnabled) {
      throw new ForbiddenException('Registration is currently disabled. Contact your administrator.');
    }

    // Check allowed email domains
    const isDomainAllowed = await this.settingsService.isEmailDomainAllowed(dto.email);
    if (!isDomainAllowed) {
      throw new ForbiddenException('Registration is not allowed for this email domain.');
    }

    // Check password minimum length
    const minLength = await this.settingsService.getPasswordMinLength();
    if (dto.password.length < minLength) {
      throw new BadRequestException(`Password must be at least ${minLength} characters.`);
    }

    const user = await this.usersService.create(dto);

    const verifyToken = uuid();
    await this.redis.set(
      `${VERIFY_TOKEN_PREFIX}${verifyToken}`,
      JSON.stringify({ userId: user.id }),
      VERIFY_TOKEN_TTL,
    );

    // Send verification email (non-blocking)
    try {
      await this.mailService.sendVerificationEmail(user.email, user.name, verifyToken);
    } catch (e) {
      console.warn('Failed to send verification email:', e);
    }

    const settings = await this.settingsService.getSettings();
    const emailVerificationRequired = settings.emailVerificationRequired;

    if (emailVerificationRequired) {
      return { message: 'Registration successful. Please verify your email.' };
    }

    // Return tokens immediately when email verification is not required
    const tokens = await this.login(user);
    return { ...tokens, user };
  }

  async verifyEmail(token: string) {
    const raw = await this.redis.get(`${VERIFY_TOKEN_PREFIX}${token}`);
    if (!raw) throw new BadRequestException('Invalid or expired token');

    const data = JSON.parse(raw);
    await this.usersService.updateProfile(data.userId, { emailVerified: true } as any);
    await this.redis.del(`${VERIFY_TOKEN_PREFIX}${token}`);
    return { message: 'Email verified successfully' };
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.passwordHash) {
      if ((user as any).status === 'SUSPENDED') {
        throw new ForbiddenException('Your account has been suspended. Contact your administrator.');
      }
      const isMatch = await bcrypt.compare(pass, user.passwordHash);
      if (isMatch) {
        const { passwordHash, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
        expiresIn: '7d',
      }),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl || null,
        locale: user.locale || null,
        timezone: user.timezone || null,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      });
      const user = await this.usersService.findById(payload.sub);
      return this.login(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return { message: 'If the email exists, a reset link has been sent' };

    const token = uuid();
    await this.redis.set(
      `${RESET_TOKEN_PREFIX}${token}`,
      JSON.stringify({ userId: user.id }),
      RESET_TOKEN_TTL,
    );

    try {
      await this.mailService.sendPasswordResetEmail(user.email, user.name, token);
    } catch (e) {
      console.warn('Failed to send reset email:', e);
    }
    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const raw = await this.redis.get(`${RESET_TOKEN_PREFIX}${token}`);
    if (!raw) throw new BadRequestException('Invalid or expired token');

    const data = JSON.parse(raw);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await this.prisma.user.update({ where: { id: data.userId }, data: { passwordHash } });

    await this.redis.del(`${RESET_TOKEN_PREFIX}${token}`);
    return { message: 'Password reset successful' };
  }

  async validateInviteToken(token: string) {
    const raw = await this.redis.get(`${INVITE_TOKEN_PREFIX}${token}`);
    if (!raw) throw new BadRequestException('Invalid or expired invitation token');
    return JSON.parse(raw) as { userId: string; email: string; name: string };
  }

  async acceptInvite(token: string, name: string, password: string) {
    const data = await this.validateInviteToken(token);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await this.prisma.user.update({
      where: { id: data.userId },
      data: { name, passwordHash, emailVerified: true },
    });

    await this.redis.del(`${INVITE_TOKEN_PREFIX}${token}`);

    return this.login(user);
  }

  async createInviteToken(userId: string, email: string, name: string): Promise<string> {
    const token = uuid();
    await this.redis.set(
      `${INVITE_TOKEN_PREFIX}${token}`,
      JSON.stringify({ userId, email, name }),
      INVITE_TOKEN_TTL,
    );
    return token;
  }

  async validateOAuthUser(profile: {
    provider: string;
    providerAccountId: string;
    email: string;
    name: string;
    avatarUrl?: string;
    accessToken?: string;
    refreshToken?: string;
  }) {
    let account = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (account) {
      await this.prisma.oAuthAccount.update({
        where: { id: account.id },
        data: { accessToken: profile.accessToken, refreshToken: profile.refreshToken },
      });
      return account.user;
    }

    let user = await this.usersService.findByEmail(profile.email);
    if (!user) {
      // Check if registration is enabled for new OAuth users
      const isEnabled = await this.settingsService.isRegistrationEnabled();
      if (!isEnabled) {
        throw new ForbiddenException('Registration is currently disabled. Contact your administrator.');
      }
      const isDomainAllowed = await this.settingsService.isEmailDomainAllowed(profile.email);
      if (!isDomainAllowed) {
        throw new ForbiddenException('Registration is not allowed for this email domain.');
      }
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          emailVerified: true,
        },
      });
    } else if ((user as any).status === 'SUSPENDED') {
      throw new ForbiddenException('Your account has been suspended. Contact your administrator.');
    }

    await this.prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
      },
    });

    return user;
  }
}
