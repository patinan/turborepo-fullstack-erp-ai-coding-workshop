import {
  type ApiError,
  ApiErrorSchema,
  ERRORS,
  type ErrorCode,
  ErrorCodeSchema,
  ValidationIssuesSchema,
} from '@erp/contracts';
import { ORPCError } from '@orpc/client';

/** The only place the error catalogue becomes Thai text (ADR-0003). */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่',
  UNAUTHENTICATED: 'กรุณาเข้าสู่ระบบ',
  INVALID_CREDENTIALS: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
  USER_INACTIVE: 'บัญชีผู้ใช้นี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ',
  FORBIDDEN: 'คุณไม่มีสิทธิ์ทำรายการนี้',
  NOT_FOUND: 'ไม่พบข้อมูลที่ต้องการ',
  CONFLICT_RETRY: 'ข้อมูลถูกแก้ไขโดยผู้อื่น กรุณาลองอีกครั้ง',
  INTERNAL_ERROR: 'ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง',
};

export function errorMessage(error: ApiError): string {
  return ERROR_MESSAGES[error.code];
}

/**
 * Turns the API's `{ code, kind, data? }` body into an `ORPCError` with that code.
 * Used by the oRPC link, so every failed call rejects with a catalogue code.
 */
export function decodeApiError(
  body: unknown,
  response: { status: number },
): ORPCError<ErrorCode, unknown> | null {
  const parsed = ApiErrorSchema.safeParse(body);
  if (!parsed.success) return null;
  return new ORPCError(parsed.data.code, { status: response.status, data: parsed.data.data });
}

/** Any error from a call as a catalogue error. Network failures and the unexpected become `INTERNAL_ERROR`. */
export function toApiError(error: unknown): ApiError {
  const code = error instanceof ORPCError ? ErrorCodeSchema.safeParse(error.code) : null;
  if (!code?.success) return { code: 'INTERNAL_ERROR', kind: ERRORS.INTERNAL_ERROR.kind };
  return { code: code.data, kind: ERRORS[code.data].kind, data: (error as ORPCError<string, unknown>).data };
}

/** The first message per top-level field of a `VALIDATION_FAILED` error, e.g. `{ username: '…' }`. */
export function fieldIssues(error: ApiError): Record<string, string> {
  if (error.code !== 'VALIDATION_FAILED') return {};
  const parsed = ValidationIssuesSchema.safeParse(error.data);
  if (!parsed.success) return {};

  const fields: Record<string, string> = {};
  for (const issue of parsed.data.issues) {
    const field = issue.path[0];
    if (field !== undefined) fields[String(field)] ??= issue.message;
  }
  return fields;
}
