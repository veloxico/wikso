import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  // TODO: Move token storage to Redis for scalability
  private resetTokens = new Map<string, { userId: string; expires: Date }>();
  private verifyTokens = new Map<string, { userId: string; expires: Date }>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    private prisma: PrismaService, // Keeping for OAuth direct access for now
  ) {}

  async register(dto: RegisterDto) {
    // UsersService.create handles duplicate check and password hashing
    const user = await this.usersService.create(dto);

    const verifyToken = uuid();
    this.verifyTokens.set(verifyToken, {
      userId: user.id,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    });

    // Send verification email (non-blocking)
    try {
      await this.mailService.sendVerificationEmail(user.email, user.name, verifyToken);
    } catch (e) {
      console.warn('Failed to send verification email:', e);
    }

    const emailVerificationRequired = process.env.EMAIL_VERIFICATION_REQUIRED === 'true';

    if (emailVerificationRequired) {
      return { message: 'Registration successful. Please verify your email.' };
    }

    // Return tokens immediately when email verification is not required
    const tokens = await this.login(user);
    return { ...tokens, user };
  }

  async verifyEmail(token: string) {
    const data = this.verifyTokens.get(token);
    if (!data || data.expires < new Date()) throw new BadRequestException('Invalid or expired token');

    await this.usersService.updateProfile(data.userId, { emailVerified: true } as any);
    this.verifyTokens.delete(token);
    return { message: 'Email verified successfully' };
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.passwordHash) {
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
    this.resetTokens.set(token, {
      userId: user.id,
      expires: new Date(Date.now() + 60 * 60 * 1000), // 1h
    });

    try {
      await this.mailService.sendPasswordResetEmail(user.email, user.name, token);
    } catch (e) {
      console.warn('Failed to send reset email:', e);
    }
    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const data = this.resetTokens.get(token);
    if (!data || data.expires < new Date()) throw new BadRequestException('Invalid or expired token');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    
    // Updating password directly via prisma or add updatePassword to UsersService
    // Using prisma direct update here since passwordHash is not in UpdateUserDto usually
    await this.prisma.user.update({ where: { id: data.userId }, data: { passwordHash } });
    
    this.resetTokens.delete(token);
    return { message: 'Password reset successful' };
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
    // ... (Keep existing OAuth logic or refactor later)
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
      // Create user via UsersService? No, it requires password. 
      // OAuth users might not have password. create() expects RegisterDto with password.
      // So create manually via prisma here for OAuth users (without password)
       user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          emailVerified: true,
        },
      });
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