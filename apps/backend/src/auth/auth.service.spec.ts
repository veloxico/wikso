import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SettingsService } from '../settings/settings.service';

jest.mock('uuid', () => ({ v4: () => 'mock-uuid-token' }));

// Mock bcryptjs entirely since its exports are non-configurable
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  genSalt: jest.fn(),
  hash: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcryptjs');

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: any;
  let jwtService: any;
  let mailService: any;
  let prismaService: any;
  let redisService: any;
  let settingsService: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'MEMBER',
    passwordHash: '$2a$10$hashedpassword',
    avatarUrl: null,
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updateProfile: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    mailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    prismaService = {
      user: { update: jest.fn() },
      oAuthAccount: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    redisService = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn(),
    };

    settingsService = {
      isRegistrationEnabled: jest.fn(),
      isEmailDomainAllowed: jest.fn(),
      getPasswordMinLength: jest.fn(),
      getSettings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
        { provide: PrismaService, useValue: prismaService },
        { provide: RedisService, useValue: redisService },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  // ---------------------------------------------------------------
  // register
  // ---------------------------------------------------------------
  describe('register', () => {
    const registerDto = { email: 'new@example.com', name: 'New User', password: 'strongpassword' };

    it('should return tokens when email verification is not required', async () => {
      settingsService.isRegistrationEnabled.mockResolvedValue(true);
      settingsService.isEmailDomainAllowed.mockResolvedValue(true);
      settingsService.getPasswordMinLength.mockResolvedValue(8);
      settingsService.getSettings.mockResolvedValue({ emailVerificationRequired: false });

      const createdUser = { id: 'user-2', email: registerDto.email, name: registerDto.name, role: 'MEMBER', avatarUrl: null };
      usersService.create.mockResolvedValue(createdUser);

      const result = await authService.register(registerDto);

      expect(settingsService.isRegistrationEnabled).toHaveBeenCalled();
      expect(settingsService.isEmailDomainAllowed).toHaveBeenCalledWith(registerDto.email);
      expect(settingsService.getPasswordMinLength).toHaveBeenCalled();
      expect(usersService.create).toHaveBeenCalledWith(registerDto);
      expect(redisService.set).toHaveBeenCalledWith(
        'auth:verify:mock-uuid-token',
        JSON.stringify({ userId: createdUser.id }),
        86400,
      );
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        createdUser.email,
        createdUser.name,
        'mock-uuid-token',
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });

    it('should return a message when email verification is required', async () => {
      settingsService.isRegistrationEnabled.mockResolvedValue(true);
      settingsService.isEmailDomainAllowed.mockResolvedValue(true);
      settingsService.getPasswordMinLength.mockResolvedValue(8);
      settingsService.getSettings.mockResolvedValue({ emailVerificationRequired: true });

      const createdUser = { id: 'user-2', email: registerDto.email, name: registerDto.name, role: 'MEMBER' };
      usersService.create.mockResolvedValue(createdUser);

      const result = await authService.register(registerDto);

      expect(result).toEqual({ message: 'Registration successful. Please verify your email.' });
      expect(result).not.toHaveProperty('accessToken');
    });

    it('should throw ForbiddenException when registration is disabled', async () => {
      settingsService.isRegistrationEnabled.mockResolvedValue(false);

      await expect(authService.register(registerDto)).rejects.toThrow(ForbiddenException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when email domain is not allowed', async () => {
      settingsService.isRegistrationEnabled.mockResolvedValue(true);
      settingsService.isEmailDomainAllowed.mockResolvedValue(false);

      await expect(authService.register(registerDto)).rejects.toThrow(ForbiddenException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when password is too short', async () => {
      settingsService.isRegistrationEnabled.mockResolvedValue(true);
      settingsService.isEmailDomainAllowed.mockResolvedValue(true);
      settingsService.getPasswordMinLength.mockResolvedValue(20);

      await expect(authService.register(registerDto)).rejects.toThrow(BadRequestException);
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // validateUser
  // ---------------------------------------------------------------
  describe('validateUser', () => {
    it('should return user without passwordHash for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const result = await authService.validateUser('test@example.com', 'correctpassword');

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it('should return null for invalid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const result = await authService.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('should return null when user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await authService.validateUser('nobody@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should throw ForbiddenException for suspended user', async () => {
      const suspendedUser = { ...mockUser, status: 'SUSPENDED' };
      usersService.findByEmail.mockResolvedValue(suspendedUser);

      await expect(
        authService.validateUser('test@example.com', 'correctpassword'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------
  // login
  // ---------------------------------------------------------------
  describe('login', () => {
    it('should return access and refresh tokens along with user info', async () => {
      jwtService.sign
        .mockReturnValueOnce('access-token-value')
        .mockReturnValueOnce('refresh-token-value');

      const user = { id: 'user-1', email: 'test@example.com', name: 'Test User', role: 'MEMBER', avatarUrl: null };
      const result = await authService.login(user);

      expect(result.accessToken).toBe('access-token-value');
      expect(result.refreshToken).toBe('refresh-token-value');
      expect(result.user).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: null,
      });

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: user.id, email: user.email, role: user.role });
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: user.id, email: user.email, role: user.role },
        expect.objectContaining({ secret: expect.any(String), expiresIn: '7d' }),
      );
    });
  });

  // ---------------------------------------------------------------
  // refresh
  // ---------------------------------------------------------------
  describe('refresh', () => {
    it('should return new tokens for a valid refresh token', async () => {
      const decodedPayload = { sub: 'user-1', email: 'test@example.com', role: 'MEMBER' };
      jwtService.verify.mockReturnValue(decodedPayload);

      const foundUser = { id: 'user-1', email: 'test@example.com', name: 'Test User', role: 'MEMBER', avatarUrl: null };
      usersService.findById.mockResolvedValue(foundUser);

      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await authService.refresh('valid-refresh-token');

      expect(jwtService.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: expect.any(String),
      });
      expect(usersService.findById).toHaveBeenCalledWith('user-1');
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw UnauthorizedException for an invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(authService.refresh('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ---------------------------------------------------------------
  // forgotPassword
  // ---------------------------------------------------------------
  describe('forgotPassword', () => {
    it('should create a reset token and send email when user exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      const result = await authService.forgotPassword('test@example.com');

      expect(redisService.set).toHaveBeenCalledWith(
        'auth:reset:mock-uuid-token',
        JSON.stringify({ userId: mockUser.id }),
        3600,
      );
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name,
        'mock-uuid-token',
      );
      expect(result).toEqual({ message: 'If the email exists, a reset link has been sent' });
    });

    it('should return the same message when user does not exist (no information leak)', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await authService.forgotPassword('nonexistent@example.com');

      expect(redisService.set).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'If the email exists, a reset link has been sent' });
    });
  });

  // ---------------------------------------------------------------
  // resetPassword
  // ---------------------------------------------------------------
  describe('resetPassword', () => {
    it('should update password and delete token for a valid reset token', async () => {
      const tokenData = JSON.stringify({ userId: 'user-1' });
      redisService.get.mockResolvedValue(tokenData);
      prismaService.user.update.mockResolvedValue(mockUser);
      bcrypt.genSalt.mockResolvedValue('mock-salt');
      bcrypt.hash.mockResolvedValue('new-hashed-password');

      const result = await authService.resetPassword('valid-reset-token', 'newStrongPassword');

      expect(redisService.get).toHaveBeenCalledWith('auth:reset:valid-reset-token');
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('newStrongPassword', 'mock-salt');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hashed-password' },
      });
      expect(redisService.del).toHaveBeenCalledWith('auth:reset:valid-reset-token');
      expect(result).toEqual({ message: 'Password reset successful' });
    });

    it('should throw BadRequestException for an invalid or expired reset token', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(
        authService.resetPassword('expired-token', 'newPassword'),
      ).rejects.toThrow(BadRequestException);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // verifyEmail
  // ---------------------------------------------------------------
  describe('verifyEmail', () => {
    it('should verify email and delete token for a valid token', async () => {
      const tokenData = JSON.stringify({ userId: 'user-1' });
      redisService.get.mockResolvedValue(tokenData);
      usersService.updateProfile.mockResolvedValue(undefined);

      const result = await authService.verifyEmail('valid-verify-token');

      expect(redisService.get).toHaveBeenCalledWith('auth:verify:valid-verify-token');
      expect(usersService.updateProfile).toHaveBeenCalledWith('user-1', { emailVerified: true });
      expect(redisService.del).toHaveBeenCalledWith('auth:verify:valid-verify-token');
      expect(result).toEqual({ message: 'Email verified successfully' });
    });

    it('should throw BadRequestException for an invalid or expired token', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(authService.verifyEmail('bad-token')).rejects.toThrow(BadRequestException);
    });
  });
});
