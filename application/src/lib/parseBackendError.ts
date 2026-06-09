import type { ApiErrorPayload } from "@/types/ApiResponses";

const UNKNOWN_ERROR = "Ha ocurrido un error inesperado";

function extractApiErrorPayload(err: unknown): ApiErrorPayload | null {
  if (err instanceof Response) {
    return null; // handled upstream
  }

  if (err && typeof err === "object" && "errors" in err) {
    const maybe = (err as Record<string, unknown>).errors;
    if (Array.isArray(maybe) && maybe.length > 0) {
      const first = maybe[0];
      if (first && typeof first === "object" && "code" in first) {
        return err as ApiErrorPayload;
      }
    }
  }

  return null;
}

export class ParsedApiError extends Error {
  status: number;
  code: string;
  detail: string;

  constructor(status: number, code: string, title: string, detail: string) {
    super(title);
    this.name = "ParsedApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }

  isValidationError(): boolean {
    return this.status === 400;
  }

  isDiscordAuthError(): boolean {
    return this.code.startsWith("DISCORD_");
  }

  isServerError(): boolean {
    return this.status >= 500;
  }

  isTokenExpired(): boolean {
    return this.code === "TOKEN_EXPIRED" || this.code === "INVALID_TOKEN";
  }
}

export async function parseBackendError(err: unknown): Promise<ParsedApiError> {
  // 1. Already a ParsedApiError
  if (err instanceof ParsedApiError) return err;

  // 2. Response object from fetch
  if (err instanceof Response) {
    try {
      const body: ApiErrorPayload = await err.json();
      if (body.errors?.length) {
        const e = body.errors[0];
        return new ParsedApiError(
          Number(e.status) || err.status,
          e.code,
          e.title,
          e.detail,
        );
      }
    } catch {
      // Response body wasn't valid JSONAPI
    }
    return new ParsedApiError(
      err.status,
      `HTTP_${err.status}`,
      err.statusText || UNKNOWN_ERROR,
      err.statusText || UNKNOWN_ERROR,
    );
  }

  // 3. Already-parsed JSON payload
  const payload = extractApiErrorPayload(err);
  if (payload) {
    const e = payload.errors[0];
    return new ParsedApiError(
      Number(e.status) || 500,
      e.code,
      e.title,
      e.detail,
    );
  }

  // 4. Error instance
  if (err instanceof Error) {
    return new ParsedApiError(500, "UNKNOWN_ERROR", err.message, err.message);
  }

  // 5. String
  if (typeof err === "string") {
    return new ParsedApiError(500, "UNKNOWN_ERROR", err, err);
  }

  // 6. Fallback
  return new ParsedApiError(500, "UNKNOWN_ERROR", UNKNOWN_ERROR, UNKNOWN_ERROR);
}

export function parseBackendErrorSync(err: unknown): ParsedApiError {
  if (err instanceof ParsedApiError) return err;

  const payload = extractApiErrorPayload(err);
  if (payload) {
    const e = payload.errors[0];
    return new ParsedApiError(
      Number(e.status) || 500,
      e.code,
      e.title,
      e.detail,
    );
  }

  if (err instanceof Error) {
    return new ParsedApiError(500, "UNKNOWN_ERROR", err.message, err.message);
  }

  if (typeof err === "string") {
    return new ParsedApiError(500, "UNKNOWN_ERROR", err, err);
  }

  return new ParsedApiError(500, "UNKNOWN_ERROR", UNKNOWN_ERROR, UNKNOWN_ERROR);
}
