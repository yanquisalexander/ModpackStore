import { APIError } from "@/lib/APIError.ts";

export class NotFoundError extends APIError {
  constructor(message: string, errorCode?: string, metadata?: Record<string, unknown>) {
    const code = errorCode ?? "NOT_FOUND";
    super(404, message, code, metadata);
    this.name = "NotFoundError";
  }
}
