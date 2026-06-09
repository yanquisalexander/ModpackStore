import { APIError } from "@/lib/APIError.ts";

export class DiscordAuthError extends APIError {
  constructor(message: string, errorCode?: string, metadata?: Record<string, unknown>) {
    const code = errorCode ?? "DISCORD_AUTH_FAILED";
    super(502, message, code, metadata);
    this.name = "DiscordAuthError";
  }
}
