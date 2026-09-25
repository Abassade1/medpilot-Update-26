import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { raw } from "express";
import { Pool } from "pg";
import { createDb, createPool } from "./db/client";
import { loadEnv } from "./config/env";
import { AccessLogInterceptor, EnvelopeExceptionFilter, RequestIdMiddleware } from "./common/http";
import { AuthGuard } from "./common/auth.guard";
import { AppThrottlerGuard } from "./common/throttle.guard";

import { HealthController } from "./modules/health/health.controller";
import { AuthController } from "./modules/auth/auth.controller";
import { AuthService } from "./modules/auth/auth.service";
import { TokenService } from "./modules/auth/token.service";
import { AuditService } from "./modules/auth/audit.service";
import { EmailService } from "./modules/email/email.service";
import { UsersController } from "./modules/users/users.controller";
import { UsersService } from "./modules/users/users.service";
import { StorageController } from "./modules/storage/storage.controller";
import { StorageService } from "./modules/storage/storage.service";
import { CatalogController } from "./modules/catalog/catalog.controller";
import { CatalogService } from "./modules/catalog/catalog.service";
import { BookingsController } from "./modules/bookings/bookings.controller";
import { BookingsService } from "./modules/bookings/bookings.service";
import { ActivitiesService } from "./modules/bookings/activities.service";
import { IdempotencyService } from "./modules/bookings/idempotency";
import { CompletionService } from "./modules/bookings/completion.service";
import { AuxController } from "./modules/aux/aux.controller";
import { AuxService } from "./modules/aux/aux.service";
import { BillingController } from "./modules/billing/billing.controller";
import { BillingService } from "./modules/billing/billing.service";
import { QuotaService } from "./modules/billing/quota.service";
import { LocationsController } from "./modules/locations/locations.controller";
import { LocationsService } from "./modules/locations/locations.service";
import { ProviderController, ListingsController, StaffVendorsController } from "./modules/vendors/vendors.controller";
import { VendorsService } from "./modules/vendors/vendors.service";
import { StaffController } from "./modules/staff/staff.controller";
import { ServicesController } from "./modules/services/services.controller";
import { ServicesService } from "./modules/services/services.service";
import { NotificationsService } from "./modules/notifications/notifications.service";
import { ReviewsController } from "./modules/reviews/reviews.controller";
import { ReviewsService } from "./modules/reviews/reviews.service";

const env = loadEnv();
const pool = createPool(env.DATABASE_URL);

@Module({
  imports: [
    ThrottlerModule.forRoot({ throttlers: [{ limit: 120, ttl: 60_000 }] }),
  ],
  controllers: [
    HealthController, AuthController, UsersController, StorageController,
    CatalogController, BookingsController, AuxController, BillingController, LocationsController, ServicesController, StaffController, ProviderController, ListingsController, StaffVendorsController, ReviewsController,
  ],
  providers: [
    { provide: Pool, useValue: pool },
    { provide: "DB", useValue: createDb(pool) },
    AuthService, TokenService, AuditService, EmailService,
    UsersService, StorageService, CatalogService,
    BookingsService, ActivitiesService, IdempotencyService, CompletionService,
    AuxService, BillingService, QuotaService, NotificationsService, LocationsService, ServicesService, VendorsService, ReviewsService,
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: EnvelopeExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*path");
    // Signed uploads carry raw bytes; every other route is JSON (set in main.ts).
    consumer
      .apply(raw({ type: "*/*", limit: "12mb" }))
      .forRoutes({ path: "v1/uploads/*path", method: RequestMethod.PUT });
  }
}
