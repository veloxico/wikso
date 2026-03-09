import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  cleanDatabase,
  createTestUser,
  createTestSpace,
} from './helpers';

describe('Spaces (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/spaces', () => {
    it('should create a new space', async () => {
      const { accessToken } = await createTestUser(app);

      const res = await request(app.getHttpServer())
        .post('/api/spaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Engineering',
          slug: 'engineering',
          description: 'Engineering team space',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Engineering');
      expect(res.body.slug).toBe('engineering');
      expect(res.body.description).toBe('Engineering team space');
    });

    it('should return 409 for duplicate slug', async () => {
      const { accessToken } = await createTestUser(app);

      await createTestSpace(app, accessToken, { slug: 'duplicate-slug' });

      await request(app.getHttpServer())
        .post('/api/spaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Another Space',
          slug: 'duplicate-slug',
        })
        .expect(409);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/spaces')
        .send({
          name: 'Unauthorized Space',
          slug: 'unauth-space',
        })
        .expect(401);
    });
  });

  describe('GET /api/spaces', () => {
    it('should list all spaces the user has access to', async () => {
      const { accessToken } = await createTestUser(app);

      await createTestSpace(app, accessToken, { slug: 'space-one', name: 'Space One' });
      await createTestSpace(app, accessToken, { slug: 'space-two', name: 'Space Two' });

      const res = await request(app.getHttpServer())
        .get('/api/spaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/spaces/:slug', () => {
    it('should return a space by slug', async () => {
      const { accessToken } = await createTestUser(app);
      const space = await createTestSpace(app, accessToken, { slug: 'my-space' });

      const res = await request(app.getHttpServer())
        .get(`/api/spaces/${space.slug}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.slug).toBe('my-space');
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name');
    });

    it('should return 403/404 for non-existent space', async () => {
      const { accessToken } = await createTestUser(app);

      // SpacePermissionGuard returns 403 before the service can throw 404
      const res = await request(app.getHttpServer())
        .get('/api/spaces/non-existent-slug')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('PATCH /api/spaces/:slug', () => {
    it('should update a space', async () => {
      const { accessToken } = await createTestUser(app);
      const space = await createTestSpace(app, accessToken, { slug: 'update-space' });

      const res = await request(app.getHttpServer())
        .patch(`/api/spaces/${space.slug}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Space Name',
          description: 'Updated description',
        })
        .expect(200);

      expect(res.body.name).toBe('Updated Space Name');
      expect(res.body.description).toBe('Updated description');
    });
  });

  describe('DELETE /api/spaces/:slug', () => {
    it('should delete a space', async () => {
      const { accessToken } = await createTestUser(app);
      const space = await createTestSpace(app, accessToken, { slug: 'delete-space' });

      const res = await request(app.getHttpServer())
        .delete(`/api/spaces/${space.slug}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message');

      // Verify space no longer exists (guard returns 403 before 404)
      const verifyRes = await request(app.getHttpServer())
        .get(`/api/spaces/${space.slug}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect([403, 404]).toContain(verifyRes.status);
    });
  });

  describe('GET /api/spaces/:slug/members', () => {
    it('should list space members', async () => {
      const { accessToken } = await createTestUser(app);
      const space = await createTestSpace(app, accessToken, { slug: 'members-space' });

      const res = await request(app.getHttpServer())
        .get(`/api/spaces/${space.slug}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // Creator should be a member
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/spaces/:slug/members', () => {
    it('should add a member to the space', async () => {
      const { accessToken } = await createTestUser(app, {
        email: 'owner@test.com',
        password: 'OwnerPass123!',
      });
      const space = await createTestSpace(app, accessToken, { slug: 'add-member-space' });

      const { user: newUser } = await createTestUser(app, {
        email: 'newmember@test.com',
        password: 'MemberPass123!',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/spaces/${space.slug}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          userId: newUser.id,
          role: 'VIEWER',
        })
        .expect(201);

      expect(res.body).toBeDefined();

      // Verify member appears in the members list
      const membersRes = await request(app.getHttpServer())
        .get(`/api/spaces/${space.slug}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const memberIds = membersRes.body.map((m: any) => m.userId || m.user?.id || m.id);
      expect(memberIds).toContain(newUser.id);
    });
  });
});
