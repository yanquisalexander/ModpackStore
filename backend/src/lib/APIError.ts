import type { ApiErrorDetail, ApiErrorPayload } from "@shared/errors.ts";

export class APIError extends Error {
  statusCode: number;
  errorCode: string;
  detail: string;
  metadata?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    errorCode?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.errorCode = errorCode ?? "API_ERROR";
    this.detail = message;
    this.metadata = metadata;
  }

  toDetail(): ApiErrorDetail {
    return {
      status: String(this.statusCode),
      code: this.errorCode,
      title: this.message,
      detail: this.detail,
    };
  }

  toPayload(): ApiErrorPayload {
    return { errors: [this.toDetail()] };
  }
}
