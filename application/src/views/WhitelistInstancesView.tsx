import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    LucideLoader,
    LucideShield,
    LucideDownload,
    LucideAlertTriangle,
    LucidePackage,
    LucideInfo
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { whitelistService } from '@/services/whitelist.service';
import { WhitelistedModpack } from '@/types/whitelist';
import { toast } from 'sonner';
import { ModpackCard } from '@/components/ModpackCard';
import { motion } from 'motion/react';

export const WhitelistInstancesView: React.FC = () => {
    const { sessionTokens, isAuthenticated } = useAuthentication();
    const [loading, setLoading] = useState(true);
    const [modpacks, setModpacks] = useState<WhitelistedModpack[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isAuthenticated && sessionTokens?.accessToken) {
            loadWhitelistedModpacks();
        }
    }, [isAuthenticated, sessionTokens?.accessToken]);

    const loadWhitelistedModpacks = async () => {
        if (!sessionTokens?.accessToken) return;

        setLoading(true);
        setError(null);

        try {
            const data = await whitelistService.getMyWhitelistedModpacks(sessionTokens.accessToken);
            setModpacks(data);
        } catch (err) {
            console.error('Error loading whitelisted modpacks:', err);
            const message = err instanceof Error ? err.message : 'Failed to load whitelisted modpacks';
            setError(message);
            toast.error('Failed to load your instances');
        } finally {
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: "spring", stiffness: 100 }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <LucideLoader className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading your available instances...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <LucideAlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button onClick={loadWhitelistedModpacks} className="mt-4">
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="flex items-center gap-3 mb-2">
                    <LucideShield className="h-8 w-8 text-primary" />
                    <h1 className="text-3xl font-bold">Available Instances</h1>
                </div>
                <p className="text-muted-foreground">
                    These modpacks are exclusively available to you via whitelist access
                </p>
            </motion.div>

            {/* Info Alert */}
            <Alert>
                <LucideInfo className="h-4 w-4" />
                <AlertDescription>
                    You have access to <strong>{modpacks.length}</strong> whitelisted {modpacks.length === 1 ? 'modpack' : 'modpacks'}.
                    These are private instances shared with you by their creators.
                </AlertDescription>
            </Alert>

            {/* Modpacks Grid */}
            {modpacks.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center space-y-4">
                            <LucidePackage className="h-16 w-16 text-muted-foreground mx-auto" />
                            <div>
                                <h3 className="text-xl font-semibold mb-2">No Instances Available</h3>
                                <p className="text-muted-foreground">
                                    You don't have access to any whitelisted modpacks yet.
                                </p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Contact modpack creators to request whitelist access to private instances.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {modpacks.map((modpack) => (
                        <motion.div key={modpack.id} variants={itemVariants}>
                            <Card className="h-full hover:shadow-lg transition-shadow">
                                <CardContent className="p-4">
                                    {/* Modpack Icon */}
                                    <div className="relative mb-3">
                                        <img
                                            src={modpack.iconUrl || '/images/modpack-fallback.webp'}
                                            alt={modpack.name}
                                            className="w-full h-40 object-cover rounded-lg"
                                        />
                                        <Badge className="absolute top-2 right-2 bg-primary">
                                            <LucideShield className="h-3 w-3 mr-1" />
                                            Whitelist
                                        </Badge>
                                    </div>

                                    {/* Modpack Info */}
                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-lg line-clamp-1">
                                            {modpack.name}
                                        </h3>
                                        
                                        {modpack.shortDescription && (
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {modpack.shortDescription}
                                            </p>
                                        )}

                                        {/* Publisher Info */}
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            {modpack.publisher.logoUrl && (
                                                <img
                                                    src={modpack.publisher.logoUrl}
                                                    alt={modpack.publisher.name}
                                                    className="h-5 w-5 rounded-full"
                                                />
                                            )}
                                            <span>{modpack.publisher.name}</span>
                                        </div>

                                        {/* Version Info */}
                                        {modpack.latestVersion && (
                                            <div className="text-xs text-muted-foreground">
                                                Latest: v{modpack.latestVersion}
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="pt-2 flex gap-2">
                                            <Button
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => {
                                                    // Navigate to modpack detail
                                                    window.location.href = `/modpack/${modpack.slug || modpack.id}`;
                                                }}
                                            >
                                                <LucideInfo className="h-4 w-4 mr-1" />
                                                View Details
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    toast.info('Installation feature coming soon!');
                                                }}
                                            >
                                                <LucideDownload className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
};
