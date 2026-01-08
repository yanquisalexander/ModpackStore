interface MCAccount {
    username: string;
    uuid: string;
    access_token: string;
    user_type: string;
}

export type ModLoaderType = 'vanilla' | 'forge' | 'fabric' | 'neoforge' | 'quilt';
export type InstanceType = 'client' | 'server';

interface MinecraftInstance {
    instanceId: string;
    usesDefaultIcon: boolean;
    iconName?: string;
    iconUrl?: string;
    instanceName: string;
    accountUuid?: string;
    minecraftPath: string;
    modpackId?: string;
    modpackInfo?: ModpackInfo;
    minecraftVersion: string;
    instanceDirectory?: string;
    forgeVersion?: string; // Deprecated, kept for backward compatibility
    loaderType?: ModLoaderType;
    loaderVersion?: string;
    ms_nickname?: string;
    instanceType?: InstanceType;
}

export type TauriCommandReturns = {
    "any": any;
    "get_instance_by_id": MinecraftInstance;
    "get_all_accounts": MCAccount[];
    "get_instances_by_modpack_id": MinecraftInstance[];
    "ensure_account_exists": Boolean;
    "add_offline_account": MCAccount;
    "search_instances": MinecraftInstance[];
    "create_instance": MinecraftInstance;
    "create_modpack_instance": MinecraftInstance;
}