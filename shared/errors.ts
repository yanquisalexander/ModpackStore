//
// Canonical error contract for the ModpackStore API.
// Both backend (Deno) and frontend (React/Tauri) use this shape.
//

export interface ApiErrorDetail {
  status: string;
  code: string;
  title: string;
  detail: string;
}

export interface ApiErrorPayload {
  errors: ApiErrorDetail[];
}

export const ErrorCodes = {
  // ── Auth / Tokens ──────────────────────────────────────
  MISSING_OR_MALFORMED_TOKEN: "MISSING_OR_MALFORMED_TOKEN",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_SESSION: "INVALID_SESSION",
  MISSING_REFRESH_TOKEN: "MISSING_REFRESH_TOKEN",
  INVALID_REFRESH_TOKEN: "INVALID_REFRESH_TOKEN",

  // ── Discord OAuth ──────────────────────────────────────
  MISSING_CODE: "MISSING_CODE",
  DISCORD_AUTH_FAILED: "DISCORD_AUTH_FAILED",
  DISCORD_TOKEN_INVALID: "DISCORD_TOKEN_INVALID",
  DISCORD_API_ERROR: "DISCORD_API_ERROR",
  NOT_IN_GUILD: "NOT_IN_GUILD",

  // ── Generic HTTP ───────────────────────────────────────
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",

  // ── User ────────────────────────────────────────────────
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_BANNED: "USER_BANNED",
  USER_NOT_IN_CONTEXT: "USER_NOT_IN_CONTEXT",
  MISSING_USER_ID: "MISSING_USER_ID",

  // ── Session ─────────────────────────────────────────────
  SESSION_INVALID: "SESSION_INVALID",
  SESSION_MISMATCH: "SESSION_MISMATCH",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
