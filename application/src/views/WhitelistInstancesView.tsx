import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    LucideLoader,
    LucideAlertTriangle,
    LucidePackage,
    LucideInfo,
    LucideShield
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { whitelistService } from '@/services/whitelist.service';
import { WhitelistedModpack } from '@/types/whitelist';
import { toast } from 'sonner';
import { ModpackCard } from '@/components/ModpackCard';
import { motion } from 'motion/react';
import { useGlobalContext } from '@/stores/GlobalContext';

export const WhitelistInstancesView: React.FC = () => {
    const { sessionTokens, isAuthenticated } = useAuthentication();
    const { setTitleBarState } = useGlobalContext();
    const [loading, setLoading] = useState(true);
    const [modpacks, setModpacks] = useState<WhitelistedModpack[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setTitleBarState({
            title: "Whitelist",
            icon: LucideShield,
            canGoBack: true,
            customIconClassName: "bg-blue-500/10",
            opaque: true,
        });
    }, [setTitleBarState]);

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
        <div className="mx-auto max-w-7xl px-8 py-10 overflow-y-auto h-full">
            {/* Header */}
            <motion.header
                className="flex flex-col mb-10"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h1 className="tracking-tight inline font-semibold text-2xl bg-gradient-to-b from-blue-200 to-blue-500 bg-clip-text text-transparent">
                    Instancias disponibles
                </h1>
                <p className="text-gray-400 text-base max-w-2xl mt-1">
                    Estos modpacks están disponibles exclusivamente para ti mediante acceso por lista blanca.
                </p>

                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground bg-blue-900/10 border border-blue-500/20 rounded-lg p-3 w-fit">
                    <LucideInfo className="h-4 w-4 text-blue-400" />
                    <span>
                        Tienes acceso a <strong className="text-blue-200">{modpacks.length}</strong> {modpacks.length === 1 ? 'modpack' : 'modpacks'} en la lista blanca
                    </span>
                </div>
            </motion.header>

            {/* Modpacks Grid */}
            {modpacks.length === 0 ? (
                <Card className="bg-neutral-900/50 border-neutral-800">
                    <CardContent className="py-16">
                        <div className="text-center space-y-4">
                            <div className="bg-neutral-800/50 p-4 rounded-full w-fit mx-auto">
                                <LucidePackage className="h-12 w-12 text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2 text-white">No Instances Available</h3>
                                <p className="text-muted-foreground max-w-md mx-auto">
                                    You don't have access to any whitelisted modpacks yet.
                                    Contact modpack creators to request whitelist access to private instances.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <motion.div
                    className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {modpacks.map((modpack) => {
                        // Adapt WhitelistedModpack to simple format for ModpackCard
                        const modpackForCard = {
                            ...modpack,
                            publisher: {
                                ...modpack.publisher,
                                publisherName: modpack.publisher.name
                            }
                        };

                        return (
                            <motion.div key={modpack.id} variants={itemVariants}>
                                <ModpackCard
                                    modpack={modpackForCard}
                                    to={`/modpack/${modpack.id}`}
                                />
                            </motion.div>
                        );
                    })}
                </motion.div>
            )}
        </div>
    );
};
