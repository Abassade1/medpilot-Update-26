import {
  ArgumentsHost, CallHandler, Catch, ExceptionFilter, ExecutionContext,
  HttpException, Injectable, NestInterceptor, NestMiddleware,
} from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import type { Request, Response, NextFunction } from "express";
import { Observable, tap } from "rxjs";
import { uuidv7 } from "uuidv7";
import { AppError } from "./errors";
import { log } from "./logger";

declare module "express-serve-static-core" {
  interface Request {
    id: string;
    userId?: string;
    userRole?: string;
    emailVerified?: boolean;
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    req.id = uuidv7();
    res.setHeader("X-Request-Id", req.id);
    next();
  }
}

/**
 * Signed upload tickets travel in the URL path. They are short-lived write
 * capabilities scoped to one object key, so the path is truncated before it
 * reaches the log rather than recorded verbatim.
 */
function safePath(path: string): string {
  return path.startsWith("/v1/uploads/") ? "/v1/uploads/:ticket" : path;
}

@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const started = Date.now();
    return next.handle().pipe(
      tap({
        finalize: () => {
          const res = ctx.switchToHttp().getResponse<Response>();
          log.info("request", {
            requestId: req.id, method: req.method, path: safePath(req.path),
            status: res.statusCode, ms: Date.now() - started,
            userId: req.userId ?? null,
          });
        },
      }),
    );
  }
}

/** Maps every thrown error onto the specification's envelope. */
@Catch()
export class EnvelopeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let status = 500;
    let code = "internal";
    let message = "Something went wrong. Please try again.";
    let fields: Record<string, string> | undefined;
    let meta: Record<string, unknown> | undefined;

    if (exception instanceof AppError) {
      ({ status, code, message, fields, meta } = exception);
    } else if (exception instanceof ThrottlerException) {
      status = 429; code = "rate_limited"; message = "Too many requests. Please slow down.";
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status === 404 ? "not_found" : status === 401 ? "unauthenticated"
        : status === 403 ? "forbidden" : status === 400 ? "bad_request" : "internal";
      const r = exception.getResponse();
      message = typeof r === "string" ? r : ((r as any).message?.toString?.() ?? exception.message);
      if (status >= 500) message = "Something went wrong. Please try again.";
    } else {
      // Unknown failure: full detail to the log, nothing internal to the client.
      log.error("unhandled_exception", {
        requestId: req?.id, path: req?.path,
        error: exception instanceof Error ? exception.stack : String(exception),
      });
    }

    res.status(status).json({
      error: { code, message, ...(fields ? { fields } : {}), ...(meta ?? {}), requestId: req?.id },
    });
  }
}
