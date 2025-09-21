// TypeScript enums for database enums

export enum TransactionType {
    PURCHASE = 'purchase',
    COMMISSION = 'commission',
    DEPOSIT = 'deposit',
    WITHDRAWAL = 'withdrawal'
}

export enum ModpackVisibility {
    PUBLIC = 'public',
    PRIVATE = 'private',
    PATREON = 'patreon'
}

export enum ModpackStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
    DELETED = 'deleted'
}

export enum ModpackVersionStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
    DELETED = 'deleted'
}

export enum PublisherMemberRole {
    OWNER = 'owner',
    ADMIN = 'admin',
    MEMBER = 'member'
}

export enum UserRole {
    USER = 'user',
    ADMIN = 'admin',
    SUPERADMIN = 'superadmin',
    SUPPORT = 'support',
    SYSTEM = 'system'
}

export enum TicketStatus {
    OPEN = 'open',
    IN_REVIEW = 'in_review',
    CLOSED = 'closed'
}

export enum AcquisitionMethod {
    FREE = 'free',
    PAID = 'paid',
    PASSWORD = 'password',
    TWITCH_SUB = 'twitch_sub'
}

export enum AcquisitionStatus {
    ACTIVE = 'active',
    REVOKED = 'revoked',
    SUSPENDED = 'suspended'
}

// Social system enums
export enum FriendshipStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    BLOCKED = 'blocked'
}

export enum InvitationStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    DECLINED = 'declined',
    EXPIRED = 'expired'
}

export enum ActivityType {
    USER_ONLINE = 'user_online',
    USER_OFFLINE = 'user_offline',
    PLAYING_MODPACK = 'playing_modpack',
    STOPPED_PLAYING = 'stopped_playing',
    MODPACK_INSTALLED = 'modpack_installed',
    MODPACK_UNINSTALLED = 'modpack_uninstalled',
    ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
    FRIENDSHIP_CREATED = 'friendship_created'
}