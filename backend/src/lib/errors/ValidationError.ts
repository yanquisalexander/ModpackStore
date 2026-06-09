import { APIError } from "@/lib/APIError.ts";

export class ValidationError extends APIError {
  constructor(message: string, errorCode?: string, metadata?: Record<string, unknown>) {
    const code = errorCode ?? "VALIDATION_ERROR";
    super(400, message, code, metadata);
    this.name = "ValidationError";
  }
}
