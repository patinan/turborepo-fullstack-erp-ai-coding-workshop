import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { SmartCoercionPlugin } from '@orpc/json-schema';
import { ORPCModule } from '@orpc/nest';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { AuthModule } from './auth/auth.module.js';
import { ClockModule } from './clock/clock.module.js';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { encodeApiError, toApiError } from './errors/api-error.js';
import { ApiErrorFilter } from './errors/api-error.filter.js';
import { HealthModule } from './health/health.module.js';
import { OpenApiModule } from './openapi/openapi.module.js';
import { StockModule } from './stock/stock.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Repo-root .env (optional). Real environment variables always take precedence.
      envFilePath: ['../../.env'],
      validate: validateEnv,
    }),
    // Every failed oRPC call answers { code, kind, data? } (ADR-0003).
    ORPCModule.forRoot({
      customErrorResponseBodyEncoder: (error) => encodeApiError(toApiError(error)),
      // Query parameters arrive as strings: turn `page=2` and `lowOnly=true` into what the schema expects.
      plugins: [new SmartCoercionPlugin({ schemaConverters: [new ZodToJsonSchemaConverter()] })],
    }),
    ClockModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    OpenApiModule,
    StockModule,
  ],
  // The same body for errors thrown outside oRPC, e.g. by AuthGuard.
  providers: [{ provide: APP_FILTER, useClass: ApiErrorFilter }],
})
export class AppModule {}
