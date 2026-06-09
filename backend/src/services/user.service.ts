import { ValidationError } from "@/lib/errors/index.ts";
import { memoryStore, type DiscordUserData } from "@/db/memory-store.ts";

export const userService = {
  upsertDiscordUser(data: DiscordUserData) {
    const { discordId, username, email } = data;

    if (!discordId?.trim()) {
      throw new ValidationError("Discord ID is required", "MISSING_DISCORD_ID");
    }
    if (!username?.trim()) {
      throw new ValidationError("Username is required", "MISSING_USERNAME");
    }
    if (!email?.trim()) {
      throw new ValidationError("Email is required for new user creation", "MISSING_EMAIL");
    }

    return memoryStore.upsertDiscordUser(data);
  },

  updateDiscordTokens(userId: string, accessToken: string, refreshToken: string) {
    memoryStore.updateDiscordTokens(userId, accessToken, refreshToken);
  },
};
