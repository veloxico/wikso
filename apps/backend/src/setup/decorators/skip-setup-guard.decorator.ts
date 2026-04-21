import { SetMetadata } from '@nestjs/common';

export const SKIP_SETUP_GUARD = 'skipSetupGuard';

/**
 * Mark a route as accessible even when setup is incomplete.
 * Used for health checks and other infra endpoints that must respond
 * during the setup wizard phase.
 */
export const SkipSetupGuard = () => SetMetadata(SKIP_SETUP_GUARD, true);
