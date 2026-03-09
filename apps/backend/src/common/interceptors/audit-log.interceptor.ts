import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

/** Fields that must never be persisted in audit logs. */
const SENSITIVE_FIELDS = new Set([
  'password', 'currentPassword', 'newPassword', 'confirmPassword',
  'secret', 'token', 'accessToken', 'refreshToken',
  'apiKey', 'creditCard', 'ssn',
]);

/** Return a shallow copy of `obj` with sensitive fields redacted. */
function sanitizeBody(obj: any): Record<string, any> | null {
  if (!obj || typeof obj !== 'object') return null;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value;
  }
  return result;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    if (method === 'GET') return next.handle();

    const userId = request.user?.id;
    const action = `${method} ${request.route?.path || request.url}`;

    return next.handle().pipe(
      tap(async (data) => {
        try {
          const entityId = data?.id || request.params?.id || request.params?.pageId || 'unknown';
          const entityType = this.extractEntityType(request.route?.path || request.url);
          await this.prisma.auditLog.create({
            data: {
              userId,
              action,
              entityType,
              entityId: String(entityId),
              meta: { body: sanitizeBody(request.body), params: request.params } as any,
            },
          });
        } catch {}
      }),
    );
  }

  private extractEntityType(path: string): string {
    const segments = path.split('/').filter(Boolean);
    return segments[0] || 'unknown';
  }
}
