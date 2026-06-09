import { APIError } from "@/lib/APIError.ts";

export class UnauthorizedError extends APIError {
  constructor(message: string, errorCode?: string, metadata?: Record<string, unknown>) {
    const code = errorCode ?? "UNAUTHORIZED";
    super(401, message, code, metadata);
    this.name = "UnauthorizedError";
  }
}
