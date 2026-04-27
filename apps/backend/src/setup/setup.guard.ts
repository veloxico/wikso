import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { SKIP_SETUP_GUARD } from './decorators/skip-setup-guard.decorator';

/**
 * Global guard: while setup is incomplete, only /api/setup/* and endpoints
 * marked with @SkipSetupGuard() are allowed through. Everything else gets
 * 503 Service Unavailable with a clear "setup required" signal.
 */
@Injectable()
export class SetupGuard implements CanActivate {
  private readonly logger = new Logger(SetupGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly appConfig: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const path = req.originalUrl || req.url || '';

    // Check for @SkipSetupGuard() decorator
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SETUP_GUARD, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return true;

    // Always allow: setup endpoints + health check
    if (
      path.startsWith('/api/setup/') ||
      path.startsWith('/api/v1/setup/') ||
      path === '/api/v1/health' ||
      path === '/api/health'
    ) {
      return true;
    }

    // If setup is complete AND Prisma is connected, let everything through
    if (this.appConfig.isSetupComplete() && this.prisma.isReady) {
      return true;
    }

    // Block with a structured 503 the frontend can parse
    throw new ServiceUnavailableException({
      error: 'SETUP_REQUIRED',
      message: 'Wikso is not yet configured. Visit /setup to initialize.',
      setupRequired: true,
    });
  }
}
