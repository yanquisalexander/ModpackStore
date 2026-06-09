import { UserRole } from "@/types/enums.ts";

export interface StoredUser {
  id: string;
  discordId: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  discordAccessToken: string | null;
  discordRefreshToken: string | null;
  provider: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredSession {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscordUserData {
  discordId: string;
  username: string;
  email: string;
  avatar: string | null;
}

class MemoryStore {
  private users = new Map<string, StoredUser>();
  private sessions = new Map<string, StoredSession>();
  private discordIdToUserId = new Map<string, string>();
  private userIdToSessionIds = new Map<string, Set<string>>();

  // ── User operations ──────────────────────────────────────

  findUserById(id: string): StoredUser | undefined {
    return this.users.get(id);
  }

  findUserByDiscordId(discordId: string): StoredUser | undefined {
    const userId = this.discordIdToUserId.get(discordId);
    if (!userId) return undefined;
    return this.users.get(userId);
  }

  upsertDiscordUser(data: DiscordUserData): StoredUser {
    const existing = this.findUserByDiscordId(data.discordId);
    const now = new Date();
    const avatarUrl = data.avatar
      ? `https://cdn.discordapp.com/avatars/${data.discordId}/${data.avatar}.png`
      : null;

    if (existing) {
      const updated: StoredUser = {
        ...existing,
        username: data.username,
        email: data.email,
        avatarUrl,
        lastLoginAt: now,
        updatedAt: now,
      };
      this.users.set(existing.id, updated);
      return updated;
    }

    const id = crypto.randomUUID();
    const newUser: StoredUser = {
      id,
      discordId: data.discordId,
      username: data.username,
      email: data.email,
      avatarUrl,
      role: UserRole.USER,
      discordAccessToken: null,
      discordRefreshToken: null,
      provider: "discord",
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(id, newUser);
    this.discordIdToUserId.set(data.discordId, id);
    return newUser;
  }

  updateDiscordTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
  ): void {
    const user = this.users.get(userId);
    if (!user) return;
    user.discordAccessToken = accessToken;
    user.discordRefreshToken = refreshToken;
    user.updatedAt = new Date();
  }

  // ── Session operations ───────────────────────────────────

  createSession(userId: string): StoredSession {
    const now = new Date();
    const session: StoredSession = {
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.id, session);

    const userSessions = this.userIdToSessionIds.get(userId) ?? new Set();
    userSessions.add(session.id);
    this.userIdToSessionIds.set(userId, userSessions);

    return session;
  }

  findSessionById(id: string): StoredSession | undefined {
    return this.sessions.get(id);
  }

  deleteSessionById(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      this.sessions.delete(id);
      const userSessions = this.userIdToSessionIds.get(session.userId);
      if (userSessions) {
        userSessions.delete(id);
        if (userSessions.size === 0) {
          this.userIdToSessionIds.delete(session.userId);
        }
      }
    }
  }

  deleteSessionsByUserId(userId: string): void {
    const userSessions = this.userIdToSessionIds.get(userId);
    if (userSessions) {
      for (const sessionId of userSessions) {
        this.sessions.delete(sessionId);
      }
      this.userIdToSessionIds.delete(userId);
    }
  }
}

export const memoryStore = new MemoryStore();
