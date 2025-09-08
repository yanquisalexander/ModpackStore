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
    PASSWORD = 'password',
    PURCHASE = 'purchase',
    TWITCH = 'twitch'
}

export enum AcquisitionStatus {
    ACTIVE = 'active',
    REVOKED = 'revoked',
    SUSPENDED = 'suspended'
}