const DISCORD_CLIENT_ID = Deno.env.get("DISCORD_CLIENT_ID")!;
const DISCORD_CLIENT_SECRET = Deno.env.get("DISCORD_CLIENT_SECRET")!;
const DISCORD_REDIRECT_URI = Deno.env.get("DISCORD_CALLBACK_URL")!;

const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_USER_URL = "https://discord.com/api/users/@me";
const DISCORD_AUTHORIZE_URL = "https://discord.com/api/oauth2/authorize";

export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email: string;
  verified?: boolean;
  locale?: string;
  mfa_enabled?: boolean;
  flags?: number;
  premium_type?: number;
}

export function getOAuthUrl(): string {
  const url = new URL(DISCORD_AUTHORIZE_URL);
  url.searchParams.set("client_id", DISCORD_CLIENT_ID);
  url.searchParams.set("redirect_uri", DISCORD_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify email guilds");
  return url.toString();
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri?: string,
): Promise<DiscordTokenResponse> {
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri ?? DISCORD_REDIRECT_URI,
  });

  const response = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Discord token exchange failed:", errorData);
    throw new Error(
      `Discord token exchange failed: ${errorData.error_description || response.statusText}`,
    );
  }

  return response.json();
}

export async function getDiscordUser(
  accessToken: string,
): Promise<DiscordUser> {
  const response = await fetch(DISCORD_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Discord user: ${response.statusText}`,
    );
  }

  return response.json();
}
