import React from 'react';
import { useUserFlags, useFlag, useActionLimit } from '@/hooks/useUserFlags';

/**
 * Demo component showing how to use user flags
 * This can be used in any part of the application to conditionally render features
 * based on the user's Modpack Store+ tier
 */
export const UserFlagsDemo: React.FC = () => {
    const { flags, loading, error, refetch } = useUserFlags();
    const { value: canUploadCover } = useFlag('can_upload_cover_image');
    const { allowed, limit, remaining } = useActionLimit('max_instances_allowed', 5);

    if (loading) {
        return (
            <div className="p-4 rounded-lg bg-gray-800 text-white">
                <p>Loading user flags...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 rounded-lg bg-red-900 text-white">
                <p>Error loading flags: {error.message}</p>
                <button 
                    onClick={refetch}
                    className="mt-2 px-4 py-2 bg-red-700 hover:bg-red-600 rounded"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 rounded-lg bg-gray-800 text-white space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">User Flags Demo</h2>
                <button 
                    onClick={refetch}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm"
                >
                    Refresh
                </button>
            </div>

            <div className="space-y-2">
                <h3 className="text-lg font-semibold">Instance Limits</h3>
                <div className="pl-4 space-y-1">
                    <p>Max Instances: {flags.max_instances_allowed}</p>
                    <p>Current: 5 / {limit}</p>
                    <p>Remaining: {remaining}</p>
                    <p className={allowed ? 'text-green-400' : 'text-red-400'}>
                        {allowed ? '✓ Can create more instances' : '✗ Instance limit reached'}
                    </p>
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-lg font-semibold">Feature Flags</h3>
                <div className="pl-4 space-y-1">
                    <FlagItem 
                        label="Upload Cover Image" 
                        enabled={flags.can_upload_cover_image} 
                    />
                    <FlagItem 
                        label="Priority Support" 
                        enabled={flags.priority_support} 
                    />
                    <FlagItem 
                        label="Early Access Features" 
                        enabled={flags.early_access_features} 
                    />
                    <FlagItem 
                        label="Advanced Analytics" 
                        enabled={flags.advanced_analytics} 
                    />
                    <FlagItem 
                        label="Custom Badges" 
                        enabled={flags.custom_badges} 
                    />
                    <FlagItem 
                        label="Create Private Modpacks" 
                        enabled={flags.can_create_private_modpacks} 
                    />
                    <FlagItem 
                        label="Create Patreon Exclusive" 
                        enabled={flags.can_create_patreon_exclusive} 
                    />
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-lg font-semibold">Limits</h3>
                <div className="pl-4 space-y-1">
                    <p>Max Modpack Size: {flags.max_modpack_size_mb} MB</p>
                    <p>Max Storage: {flags.max_storage_gb} GB</p>
                    <p>Max Publishers: {flags.max_publishers}</p>
                    <p>Max Modpacks per Publisher: {flags.max_modpacks_per_publisher}</p>
                    <p>API Rate Limit Multiplier: {flags.api_rate_limit_multiplier}x</p>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-400">
                    Flags are automatically updated based on your Patreon tier. 
                    {canUploadCover ? ' You have premium features enabled!' : ' Upgrade to unlock more features!'}
                </p>
            </div>
        </div>
    );
};

/**
 * Helper component to display a flag item
 */
const FlagItem: React.FC<{ label: string; enabled: boolean }> = ({ label, enabled }) => {
    return (
        <p className={enabled ? 'text-green-400' : 'text-gray-400'}>
            {enabled ? '✓' : '✗'} {label}
        </p>
    );
};
