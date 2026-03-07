import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

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
              meta: { body: request.body, params: request.params },
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
