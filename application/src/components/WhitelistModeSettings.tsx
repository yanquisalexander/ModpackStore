import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LucideShield, LucideInfo } from 'lucide-react';
import { useWhitelistMode } from '@/hooks/useWhitelistMode';

export const WhitelistModeSettings: React.FC = () => {
    const { 
        hasWhitelists, 
        whitelistCount, 
        isWhitelistMode, 
        setWhitelistMode,
        loading 
    } = useWhitelistMode();

    if (loading) {
        return null; // Don't show anything while loading
    }

    // Only show this setting if user has whitelists
    if (!hasWhitelists) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <LucideShield className="h-5 w-5 text-primary" />
                        <CardTitle>Whitelist Mode</CardTitle>
                    </div>
                    <Badge variant="secondary">{whitelistCount} instances</Badge>
                </div>
                <CardDescription>
                    Show your whitelisted instances as the main view
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <div className="font-medium">Enable Whitelist Mode</div>
                        <div className="text-sm text-muted-foreground">
                            When enabled, your available whitelist instances will be shown first
                        </div>
                    </div>
                    <Switch
                        checked={isWhitelistMode}
                        onCheckedChange={setWhitelistMode}
                    />
                </div>

                <Alert>
                    <LucideInfo className="h-4 w-4" />
                    <AlertDescription>
                        {isWhitelistMode ? (
                            <>
                                Your home screen will show <strong>Available Instances</strong> first. 
                                You can still browse all modpacks in the Explore section.
                            </>
                        ) : (
                            <>
                                Enable this to prioritize your whitelisted instances on the home screen.
                                Perfect if you primarily use private modpacks.
                            </>
                        )}
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
};
