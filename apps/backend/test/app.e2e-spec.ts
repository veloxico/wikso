import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api (GET) should return 404 (no route at root)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(404);
  });

  it('/api/auth/providers (GET) should be accessible', () => {
    return request(app.getHttpServer())
      .get('/api/auth/providers')
      .expect(200);
  });
});
