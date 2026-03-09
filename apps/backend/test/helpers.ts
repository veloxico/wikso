import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Creates a full NestJS application for E2E testing.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();
  return app;
}

/**
 * Cleans all tables in test database (keeps schema).
 */
export async function cleanDatabase(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  // Delete in correct order to satisfy foreign key constraints
  await prisma.favorite.deleteMany();
  await prisma.recentPage.deleteMany();
  await prisma.pageTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.pageVersion.deleteMany();
  await prisma.pagePermission.deleteMany();
  await prisma.page.deleteMany();
  await prisma.pageTemplate.deleteMany();
  await prisma.spacePermission.deleteMany();
  await prisma.space.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemSettings.deleteMany();
}

/**
 * Creates a test user and returns JWT tokens.
 */
export async function createTestUser(
  app: INestApplication,
  overrides?: { email?: string; name?: string; password?: string },
): Promise<{ accessToken: string; refreshToken: string; user: any }> {
  const email = overrides?.email || `test-${Date.now()}@test.com`;
  const name = overrides?.name || 'Test User';
  const password = overrides?.password || 'TestPassword123!';

  // Ensure system settings exist (registration enabled)
  const prisma = app.get(PrismaService);
  await prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', registrationEnabled: true },
  });

  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, name, password })
    .expect(201);

  return {
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    user: res.body.user,
  };
}

/**
 * Creates an admin user and returns JWT tokens.
 */
export async function createAdminUser(
  app: INestApplication,
  overrides?: { email?: string; name?: string; password?: string },
): Promise<{ accessToken: string; refreshToken: string; user: any }> {
  const result = await createTestUser(app, overrides);

  const prisma = app.get(PrismaService);
  await prisma.user.update({
    where: { id: result.user.id },
    data: { role: 'ADMIN' },
  });

  // Re-login to get updated token with admin role
  const loginRes = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: overrides?.email || result.user.email,
      password: overrides?.password || 'TestPassword123!',
    })
    .expect(200);

  return {
    accessToken: loginRes.body.accessToken,
    refreshToken: loginRes.body.refreshToken,
    user: loginRes.body.user,
  };
}

/**
 * Creates a test space.
 */
export async function createTestSpace(
  app: INestApplication,
  accessToken: string,
  overrides?: { name?: string; slug?: string; description?: string },
): Promise<any> {
  const slug = overrides?.slug || `test-space-${Date.now()}`;
  const res = await request(app.getHttpServer())
    .post('/api/spaces')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      name: overrides?.name || 'Test Space',
      slug,
      description: overrides?.description || 'A test space',
    })
    .expect(201);

  return res.body;
}

/**
 * Creates a test page inside a space.
 */
export async function createTestPage(
  app: INestApplication,
  accessToken: string,
  spaceSlug: string,
  overrides?: { title?: string; contentJson?: any; parentId?: string },
): Promise<any> {
  const res = await request(app.getHttpServer())
    .post(`/api/spaces/${spaceSlug}/pages`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      title: overrides?.title || 'Test Page',
      contentJson: overrides?.contentJson || { type: 'doc', content: [] },
      parentId: overrides?.parentId,
    })
    .expect(201);

  return res.body;
}

/**
 * Gets a JWT token by logging in.
 */
export async function getJwtToken(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  return res.body.accessToken;
}
