import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  cleanDatabase,
  createTestUser,
  createTestSpace,
  createTestPage,
} from './helpers';

describe('Pages (e2e)', () => {
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

  /**
   * Helper: creates a user, a space, and returns context needed for page tests.
   */
  async function setupSpaceWithUser() {
    const { accessToken, user } = await createTestUser(app);
    const space = await createTestSpace(app, accessToken, {
      slug: `space-${Date.now()}`,
    });
    return { accessToken, user, space };
  }

  describe('POST /api/spaces/:slug/pages', () => {
    it('should create a page in a space', async () => {
      const { accessToken, space } = await setupSpaceWithUser();

      const res = await request(app.getHttpServer())
        .post(`/api/spaces/${space.slug}/pages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Getting Started',
          contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Getting Started');
    });

    it('should return 401 without authentication', async () => {
      const { accessToken, space } = await setupSpaceWithUser();

      await request(app.getHttpServer())
        .post(`/api/spaces/${space.slug}/pages`)
        .send({ title: 'No Auth Page' })
        .expect(401);
    });
  });

  describe('GET /api/spaces/:slug/pages', () => {
    it('should return page tree for a space', async () => {
      const { accessToken, space } = await setupSpaceWithUser();

      await createTestPage(app, accessToken, space.slug, { title: 'Root Page' });
      await createTestPage(app, accessToken, space.slug, { title: 'Another Page' });

      const res = await request(app.getHttpServer())
        .get(`/api/spaces/${space.slug}/pages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/spaces/:slug/pages/:pageId', () => {
    it('should return a single page by id', async () => {
      const { accessToken, space } = await setupSpaceWithUser();
      const page = await createTestPage(app, accessToken, space.slug, {
        title: 'Detail Page',
      });

      const res = await request(app.getHttpServer())
        .get(`/api/spaces/${space.slug}/pages/${page.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(page.id);
      expect(res.body.title).toBe('Detail Page');
    });

    it('should return 404 for non-existent page', async () => {
      const { accessToken, space } = await setupSpaceWithUser();

      await request(app.getHttpServer())
        .get(`/api/spaces/${space.slug}/pages/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/spaces/:slug/pages/:pageId', () => {
    it('should update a page title', async () => {
      const { accessToken, space } = await setupSpaceWithUser();
      const page = await createTestPage(app, accessToken, space.slug, {
        title: 'Original Title',
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/spaces/${space.slug}/pages/${page.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(res.body.title).toBe('Updated Title');
    });

    it('should create a version when content is updated', async () => {
      const { accessToken, space } = await setupSpaceWithUser();
      const page = await createTestPage(app, accessToken, space.slug, {
        title: 'Versioned Page',
        contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      });

      // Update content to trigger version creation
      await request(app.getHttpServer())
        .patch(`/api/spaces/${space.slug}/pages/${page.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          contentJson: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated' }] }],
          },
        })
        .expect(200);

      // Verify a version was created
      const versionsRes = await request(app.getHttpServer())
        .get(`/api/spaces/${space.slug}/pages/${page.id}/versions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(versionsRes.body)).toBe(true);
      expect(versionsRes.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DELETE /api/spaces/:slug/pages/:pageId', () => {
    it('should delete a page', async () => {
      const { accessToken, space } = await setupSpaceWithUser();
      const page = await createTestPage(app, accessToken, space.slug, {
        title: 'Page To Delete',
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/spaces/${space.slug}/pages/${page.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message');

      // Verify page no longer exists
      await request(app.getHttpServer())
        .get(`/api/spaces/${space.slug}/pages/${page.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('GET /api/spaces/:slug/pages/:pageId/versions', () => {
    it('should list page versions', async () => {
      const { accessToken, space } = await setupSpaceWithUser();
      const page = await createTestPage(app, accessToken, space.slug, {
        title: 'Version Test Page',
        contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      });

      // Make an update to create at least one version
      await request(app.getHttpServer())
        .patch(`/api/spaces/${space.slug}/pages/${page.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          contentJson: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'v2' }] }],
          },
        })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/spaces/${space.slug}/pages/${page.id}/versions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('id');
    });
  });

  describe('POST /api/spaces/:slug/pages/:pageId/versions/:versionId/restore', () => {
    it('should restore a previous page version', async () => {
      const { accessToken, space } = await setupSpaceWithUser();
      const page = await createTestPage(app, accessToken, space.slug, {
        title: 'Restore Test Page',
        contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      });

      // Update content to create a version
      await request(app.getHttpServer())
        .patch(`/api/spaces/${space.slug}/pages/${page.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          contentJson: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'changed' }] }],
          },
        })
        .expect(200);

      // Get versions
      const versionsRes = await request(app.getHttpServer())
        .get(`/api/spaces/${space.slug}/pages/${page.id}/versions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(versionsRes.body.length).toBeGreaterThanOrEqual(1);

      const versionId = versionsRes.body[0].id;

      // Restore the version
      const restoreRes = await request(app.getHttpServer())
        .post(`/api/spaces/${space.slug}/pages/${page.id}/versions/${versionId}/restore`)
        .set('Authorization', `Bearer ${accessToken}`);

      // Accept either 200 or 201 as valid restore responses
      expect([200, 201]).toContain(restoreRes.status);
    });
  });
});
