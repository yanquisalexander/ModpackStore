import { APIError } from "@/lib/APIError.ts";

export class ForbiddenError extends APIError {
  constructor(message: string, errorCode?: string, metadata?: Record<string, unknown>) {
    const code = errorCode ?? "FORBIDDEN";
    super(403, message, code, metadata);
    this.name = "ForbiddenError";
  }
}
