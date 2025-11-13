import React from 'react';
import { ExploreSection } from './ExploreSection';
import { WhitelistInstancesView } from './WhitelistInstancesView';
import { useWhitelistMode } from '@/hooks/useWhitelistMode';
import { LucideLoader } from 'lucide-react';

/**
 * HomeView wrapper that conditionally shows WhitelistInstancesView or ExploreSection
 * based on user's whitelist mode preference
 */
export const HomeView: React.FC = () => {
    const { isWhitelistMode, loading } = useWhitelistMode();

    // Show loading state while checking whitelist mode
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LucideLoader className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Show whitelist instances if mode is enabled, otherwise show explore
    return isWhitelistMode ? <WhitelistInstancesView /> : <ExploreSection />;
};
