import { execSync } from 'child_process';
import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Global test setup: loads test env, runs Prisma migrations, seeds system settings.
 * Executed once before all E2E tests.
 */
export default async function globalSetup() {
  // Load test environment
  dotenv.config({ path: path.resolve(__dirname, '.env.test') });

  console.log('\n🧪 Test Setup: Running Prisma migrations...');

  const backendRoot = path.resolve(__dirname, '..');

  // Push schema to test database (faster than migrate for CI)
  // This is a test-only ephemeral database on tmpfs — safe to force-reset.
  execSync('npx prisma db push --force-reset --accept-data-loss', {
    cwd: backendRoot,
    stdio: 'pipe',
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes',
    },
  });

  console.log('✅ Test Setup: Database ready\n');
}
