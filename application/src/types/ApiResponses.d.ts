export interface ApiErrorDetail {
    code: string;
    detail: string;
    status: string;
    title: string;
}

export interface ApiErrorPayload {
    errors: ApiErrorDetail[];
}

export interface ModpackDataOverview {
    id?: string;
    name?: string;
    shortDescription?: null;
    description?: string;
    slug?: string;
    iconUrl?: string;
    bannerUrl?: string;
    trailerUrl?: string;
    visibility?: string;
    showUserAsPublisher?: boolean;
    creatorUserId?: string;
    createdAt?: Date;
    updatedAt?: Date;
    creatorUser?: CreatorUser;
    publisher?: Publisher;
    isPasswordProtected?: boolean;
    requiresTwitchSubscription?: boolean;
    twitchCreatorIds?: string[];
    requiredTwitchChannels?: string[];
}

export interface CreatorUser {
    id?: string;
    username?: string;
    email?: string;
    avatarUrl?: string;
    discordId?: string;
    discordAccessToken?: string;
    discordRefreshToken?: string;
    patreonId?: null;
    patreonAccessToken?: null;
    patreonRefreshToken?: null;
    twitchId?: string;
    twitchAccessToken?: string;
    twitchRefreshToken?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Publisher {
    id?: string;
    publisherName?: string;
    verified?: boolean;
    partnered?: boolean;
    isHostingPartner?: boolean;
}
