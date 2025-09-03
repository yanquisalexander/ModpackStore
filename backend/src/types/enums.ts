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
    ARCHIVED = 'archived'
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
    SYSTEM = 'system'
}