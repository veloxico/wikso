import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  cleanDatabase,
  createTestUser,
} from './helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    beforeEach(async () => {
      // Ensure registration is enabled
      await prisma.systemSettings.upsert({
        where: { id: 'singleton' },
        update: { registrationEnabled: true },
        create: { id: 'singleton', registrationEnabled: true },
      });
    });

    it('should register a new user and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'newuser@test.com',
          name: 'New User',
          password: 'SecurePass123!',
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('newuser@test.com');
      expect(res.body.user.name).toBe('New User');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('should return 409 for duplicate email', async () => {
      await createTestUser(app, { email: 'duplicate@test.com' });

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'duplicate@test.com',
          name: 'Another User',
          password: 'SecurePass123!',
        })
        .expect(409);
    });

    it('should return 400 for invalid email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          name: 'Bad Email User',
          password: 'SecurePass123!',
        })
        .expect(400);
    });

    it('should return 400 for short password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'shortpass@test.com',
          name: 'Short Pass User',
          password: '123',
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    const testEmail = 'login-user@test.com';
    const testPassword = 'LoginPass123!';

    beforeEach(async () => {
      await createTestUser(app, {
        email: testEmail,
        password: testPassword,
        name: 'Login Test User',
      });
    });

    it('should login with valid credentials and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testEmail);
    });

    it('should return 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'WrongPassword123!' })
        .expect(401);
    });

    it('should return 401 for non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nouser@test.com', password: 'SomePass123!' })
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return new tokens with a valid refresh token', async () => {
      const { refreshToken } = await createTestUser(app);

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should return 401 for an invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token-string' })
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout with a valid JWT', async () => {
      const { accessToken } = await createTestUser(app);

      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('message');
    });

    it('should return 401 without a JWT', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .expect(401);
    });
  });

  describe('GET /api/auth/providers', () => {
    it('should return provider availability', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/providers')
        .expect(200);

      expect(res.body).toBeDefined();
      expect(typeof res.body).toBe('object');
    });
  });

  describe('GET /api/auth/settings/public', () => {
    beforeEach(async () => {
      await prisma.systemSettings.upsert({
        where: { id: 'singleton' },
        update: { registrationEnabled: true },
        create: { id: 'singleton', registrationEnabled: true },
      });
    });

    it('should return public settings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/settings/public')
        .expect(200);

      expect(res.body).toHaveProperty('registrationEnabled');
      expect(typeof res.body.registrationEnabled).toBe('boolean');
    });
  });
});
