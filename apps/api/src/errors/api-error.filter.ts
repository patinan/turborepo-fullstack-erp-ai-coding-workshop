import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { encodeApiError, toApiError } from './api-error.js';

/**
 * Errors thrown outside an oRPC handler (guards, unknown routes) reach Nest instead of oRPC.
 * This gives them the same `{ code, kind, data? }` body.
 */
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const error = toApiError(exception);
    host.switchToHttp().getResponse<Response>().status(error.status).json(encodeApiError(error));
  }
}
