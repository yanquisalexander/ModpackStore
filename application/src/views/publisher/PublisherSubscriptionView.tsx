import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
    LucideCrown,
    LucideLoader,
    LucideCheck,
    LucideX,
    LucideAlertTriangle,
    LucideUsers,
    LucidePackage,
    LucideHardDrive,
    LucideShield,
    LucideSparkles
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { subscriptionService } from '@/services/subscription.service';
import { PublisherSubscription, SubscriptionTier, TIER_DEFAULTS, TIER_PRICES } from '@/types/subscription';
import { toast } from 'sonner';

// Plan comparison data
const PLAN_FEATURES = [
    { key: 'whitelistMaxPlayers', label: 'Max Whitelist Players', icon: LucideUsers },
    { key: 'maxMembers', label: 'Team Members', icon: LucideUsers },
    { key: 'maxModpacks', label: 'Modpacks', icon: LucidePackage, formatter: (val: number) => val === -1 ? 'Unlimited' : val },
    { key: 'storageLimitMB', label: 'Storage', icon: LucideHardDrive, formatter: (val: number) => `${val >= 1024 ? (val / 1024).toFixed(1) + ' GB' : val + ' MB'}` },
    { key: 'customBranding', label: 'Custom Branding', icon: LucideSparkles, formatter: (val: boolean) => val ? 'Yes' : 'No' },
    { key: 'prioritySupport', label: 'Priority Support', icon: LucideShield, formatter: (val: boolean) => val ? 'Yes' : 'No' },
    { key: 'analyticsAccess', label: 'Analytics Access', icon: LucideSparkles, formatter: (val: boolean) => val ? 'Yes' : 'No' },
    { key: 'featuredModpacks', label: 'Featured Modpacks', icon: LucideSparkles },
];

export const PublisherSubscriptionView: React.FC = () => {
    const { publisherId } = useParams<{ publisherId: string }>();
    const { sessionTokens } = useAuthentication();

    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<PublisherSubscription | null>(null);
    const [features, setFeatures] = useState<Record<string, any>>({});

    useEffect(() => {
        if (publisherId && sessionTokens?.accessToken) {
            loadSubscription();
        }
    }, [publisherId, sessionTokens?.accessToken]);

    const loadSubscription = async () => {
        if (!publisherId || !sessionTokens?.accessToken) return;

        setLoading(true);
        try {
            const [subData, featuresData] = await Promise.all([
                subscriptionService.getPublisherSubscription(publisherId, sessionTokens.accessToken),
                subscriptionService.getPublisherFeatures(publisherId, sessionTokens.accessToken)
            ]);
            
            setSubscription(subData);
            setFeatures(featuresData);
        } catch (error) {
            console.error('Error loading subscription:', error);
            toast.error('Failed to load subscription information');
        } finally {
            setLoading(false);
        }
    };

    const getTierColor = (tier: SubscriptionTier) => {
        switch (tier) {
            case SubscriptionTier.FREE: return 'bg-gray-500';
            case SubscriptionTier.BASIC: return 'bg-blue-500';
            case SubscriptionTier.PREMIUM: return 'bg-purple-500';
            case SubscriptionTier.ENTERPRISE: return 'bg-amber-500';
            default: return 'bg-gray-500';
        }
    };

    const getTierFeatures = (tier: SubscriptionTier) => {
        return TIER_DEFAULTS[tier];
    };

    const getUsagePercentage = (current: number, max: number) => {
        if (max === -1) return 0; // Unlimited
        return Math.min((current / max) * 100, 100);
    };

    const renderCurrentPlan = () => {
        if (!subscription) {
            return (
                <Alert>
                    <LucideAlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        No active subscription found. You are currently on the FREE tier.
                    </AlertDescription>
                </Alert>
            );
        }

        const currentFeatures = getTierFeatures(subscription.tier);
        const isExpiringSoon = subscription.daysUntilExpiry !== null && 
                               subscription.daysUntilExpiry !== undefined && 
                               subscription.daysUntilExpiry <= 7 && 
                               subscription.daysUntilExpiry > 0;

        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${getTierColor(subscription.tier)}`}>
                                <LucideCrown className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl">
                                    {subscription.tier.toUpperCase()} Plan
                                </CardTitle>
                                <CardDescription>
                                    {subscription.isActive ? 'Active' : 'Inactive'}
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant={subscription.isActive ? 'default' : 'secondary'}>
                            {subscription.status}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Expiration Warning */}
                    {isExpiringSoon && (
                        <Alert variant="destructive">
                            <LucideAlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                Your subscription expires in {subscription.daysUntilExpiry} days. 
                                Renew soon to avoid losing premium features.
                            </AlertDescription>
                        </Alert>
                    )}

                    {subscription.expiresAt && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Expires on</p>
                            <p className="font-medium">
                                {new Date(subscription.expiresAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                    )}

                    <Separator />

                    {/* Current Limits */}
                    <div className="space-y-4">
                        <h3 className="font-semibold">Plan Limits</h3>
                        
                        {/* Whitelist Players */}
                        {currentFeatures.canUseWhitelist && (
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>Whitelist Players</span>
                                    <span className="text-muted-foreground">
                                        0 / {currentFeatures.whitelistMaxPlayers}
                                    </span>
                                </div>
                                <Progress value={0} className="h-2" />
                            </div>
                        )}

                        {/* Team Members */}
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span>Team Members</span>
                                <span className="text-muted-foreground">
                                    0 / {currentFeatures.maxMembers}
                                </span>
                            </div>
                            <Progress value={0} className="h-2" />
                        </div>

                        {/* Modpacks */}
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span>Modpacks</span>
                                <span className="text-muted-foreground">
                                    0 / {currentFeatures.maxModpacks === -1 ? '∞' : currentFeatures.maxModpacks}
                                </span>
                            </div>
                            {currentFeatures.maxModpacks !== -1 && (
                                <Progress value={0} className="h-2" />
                            )}
                        </div>

                        {/* Storage */}
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span>Storage</span>
                                <span className="text-muted-foreground">
                                    0 MB / {currentFeatures.storageLimitMB >= 1024 
                                        ? `${(currentFeatures.storageLimitMB / 1024).toFixed(1)} GB`
                                        : `${currentFeatures.storageLimitMB} MB`
                                    }
                                </span>
                            </div>
                            <Progress value={0} className="h-2" />
                        </div>
                    </div>

                    {/* Feature Overrides Notice */}
                    {subscription.features.some(f => f.isOverride) && (
                        <Alert>
                            <LucideShield className="h-4 w-4" />
                            <AlertDescription>
                                Some features have been manually adjusted by an administrator.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        );
    };

    const renderPlanComparison = () => {
        const tiers = [SubscriptionTier.FREE, SubscriptionTier.BASIC, SubscriptionTier.PREMIUM, SubscriptionTier.ENTERPRISE];

        return (
            <Card>
                <CardHeader>
                    <CardTitle>Compare Plans</CardTitle>
                    <CardDescription>
                        Choose the plan that best fits your needs
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left p-3 font-semibold">Feature</th>
                                    {tiers.map(tier => (
                                        <th key={tier} className="text-center p-3">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-lg">{tier.toUpperCase()}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    ${TIER_PRICES[tier].monthly}/mo
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {PLAN_FEATURES.map((feature) => (
                                    <tr key={feature.key} className="border-b">
                                        <td className="p-3 flex items-center gap-2">
                                            <feature.icon className="h-4 w-4 text-muted-foreground" />
                                            <span>{feature.label}</span>
                                        </td>
                                        {tiers.map(tier => {
                                            const tierFeatures = getTierFeatures(tier);
                                            const value = tierFeatures[feature.key as keyof typeof tierFeatures];
                                            const displayValue = feature.formatter 
                                                ? feature.formatter(value as any)
                                                : value;

                                            return (
                                                <td key={tier} className="text-center p-3">
                                                    {typeof value === 'boolean' ? (
                                                        value ? (
                                                            <LucideCheck className="h-5 w-5 text-green-500 mx-auto" />
                                                        ) : (
                                                            <LucideX className="h-5 w-5 text-red-500 mx-auto" />
                                                        )
                                                    ) : (
                                                        <span className="font-medium">{displayValue}</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 flex justify-center gap-4">
                        {tiers.slice(1).map(tier => (
                            <Button
                                key={tier}
                                variant={subscription?.tier === tier ? 'secondary' : 'default'}
                                disabled={subscription?.tier === tier}
                                onClick={() => toast.info('Upgrade functionality coming soon!')}
                            >
                                {subscription?.tier === tier ? 'Current Plan' : `Upgrade to ${tier.toUpperCase()}`}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LucideLoader className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-3xl font-bold mb-2">Subscription Management</h1>
                <p className="text-muted-foreground">
                    Manage your publisher subscription and view available plans
                </p>
            </div>

            {renderCurrentPlan()}
            {renderPlanComparison()}
        </div>
    );
};
