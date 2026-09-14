export type SkinModel = 'classic' | 'slim';

export interface UserSkin {
    id: string;
    name: string | null;
    model: SkinModel;
    isActive: boolean;
    url: string;
    r2Key: string;
    createdAt: string;
}

export interface UserCape {
    id: string;
    name: string | null;
    isActive: boolean;
    url: string;
    r2Key: string;
    createdAt: string;
}

export interface UserTextures {
    activeSkin: UserSkin | null;
    activeCape: UserCape | null;
    skins: Array<{
        id: string;
        name: string | null;
        model: SkinModel;
        isActive: boolean;
        url: string;
        createdAt: string;
    }>;
    capes: Array<{
        id: string;
        name: string | null;
        isActive: boolean;
        url: string;
        createdAt: string;
    }>;
}
