import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
    LucideGlobe,
    LucideMessageCircle,
    LucideTwitter,
    LucideInstagram,
    LucideYoutube,
    LucideShieldCheck,
    LucidePackage,
    LucideBadgeCheck,
    LucideLoader,
    LucideShare2
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ModpackCard } from '@/components/ModpackCard';

import { useAuthentication } from '@/stores/AuthContext';
import { useGlobalContext } from '@/stores/GlobalContext';
import { publisherSettingsService, PublisherProfileData } from '@/services/publisherSettings.service';
import { whitelistService } from '@/services/whitelist.service'; // Assuming we have a service to get public modpacks by publisher

// Mock service for public profile if needed, or reuse settings service but for public endpoint
// Ideally we should have a public service method
// publisherSettingsService.getPublicProfile

interface PublicPublisherData extends PublisherProfileData {
    modpacks: {
        id: string;
        name: string;
        slug: string;
        bannerUrl: string;
        visibility: string;
        publisher: any;
    }[];
    isVerified: boolean;
    isPartner: boolean;
    memberCount: number;
    modpackCount: number;
}

const SocialLink = ({ icon: Icon, url, label }: { icon: any, url: string | null, label: string }) => {
    if (!url) return null;
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm"
        >
            <div className="bg-muted p-2 rounded-full">
                <Icon className="h-4 w-4" />
            </div>
            <span>{label}</span>
        </a>
    );
};

export const PublisherProfileView: React.FC = () => {
    const { publisherSlug } = useParams<{ publisherSlug: string }>(); // Or publisherId
    const { sessionTokens } = useAuthentication();
    const { setTitleBarState } = useGlobalContext();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<PublicPublisherData | null>(null);

    useEffect(() => {
        setTitleBarState({
            title: profile?.publisherName || "Publisher Profile",
            canGoBack: true,
            opaque: true // Starts transparent but scrolls to opaque normally handled by layout, but here forced opaque for simplicity or custom implementation
        });
    }, [profile, setTitleBarState]);


    useEffect(() => {
        loadProfile();
    }, [publisherSlug]);

    const loadProfile = async () => {
        if (!publisherSlug) return;
        setLoading(true);
        try {
            const data = await publisherSettingsService.getPublicProfile(publisherSlug);
            setProfile(data as any); // Cast to any or update state type if needed, but PublicPublisherData extension should work
        } catch (error) {
            toast.error('Failed to load publisher profile');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };



    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LucideLoader className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
                <h2 className="text-2xl font-bold mb-2">Publisher Not Found</h2>
                <p className="text-muted-foreground">The publisher you are looking for does not exist or has been removed.</p>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-background pb-10">
            {/* Hero Banner */}
            <div className="relative w-full h-64 md:h-80 bg-neutral-900 overflow-hidden">
                {profile.bannerUrl ? (
                    <img
                        src={profile.bannerUrl}
                        alt="Banner"
                        className="w-full h-full object-cover opacity-60"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-r from-blue-900 to-purple-900 opacity-40 pattern-grid-lg" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
            </div>

            <div className="container mx-auto px-4 -mt-24 relative z-10">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Logo & Basic Info */}
                    <div className="flex flex-col items-center md:items-start gap-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-background rounded-full p-2 ring-4 ring-background shadow-xl"
                        >
                            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden bg-muted">
                                {profile.logoUrl ? (
                                    <img src={profile.logoUrl} alt={profile.publisherName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-4xl font-bold">
                                        {profile.publisherName.charAt(0)}
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        <div className="text-center md:text-left space-y-2">
                            <div className="flex items-center gap-2 justify-center md:justify-start">
                                <h1 className="text-3xl md:text-4xl font-bold">{profile.publisherName}</h1>
                                {profile.isVerified && <LucideBadgeCheck className="h-6 w-6 text-blue-500" fill="currentColor" />}
                            </div>
                            {/* Stats */}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground justify-center md:justify-start">
                                <span className="flex items-center gap-1">
                                    <LucidePackage className="h-4 w-4" />
                                    {profile.modpackCount} Modpacks
                                </span>
                                {/* <span className="flex items-center gap-1">
                                     <LucideUsers className="h-4 w-4" />
                                     {profile.memberCount} Followers
                                 </span> */}
                            </div>
                        </div>
                    </div>

                    {/* Actions & Description */}
                    <div className="flex-1 pt-0 md:pt-24 space-y-6">
                        <div className="flex flex-wrap gap-2 justify-center md:justify-end">
                            <Button variant="outline" size="sm" onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                                toast.success('Link copied to clipboard');
                            }}>
                                <LucideShare2 className="mr-2 h-4 w-4" />
                                Share
                            </Button>
                            {/* <Button size="sm">Follow</Button> */}
                        </div>

                        <div className="bg-muted/30 rounded-xl p-6 backdrop-blur-sm border border-border/50">
                            <h3 className="font-semibold mb-2">About</h3>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {profile.description || "No description provided."}
                            </p>

                            <Separator className="my-4" />

                            <div className="flex flex-wrap gap-x-6 gap-y-3">
                                <SocialLink icon={LucideGlobe} url={profile.websiteUrl} label="Website" />
                                <SocialLink icon={LucideMessageCircle} url={profile.discordUrl} label="Discord" />
                                <SocialLink icon={LucideTwitter} url={profile.twitterUrl} label="Twitter" />
                                <SocialLink icon={LucideYoutube} url={profile.youtubeUrl} label="YouTube" />
                                {/* Add others */}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modpacks Section */}
                <div className="mt-16 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <LucidePackage className="h-6 w-6 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold">Created Modpacks</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {profile.modpacks
                            .filter(modpack => modpack.visibility === 'public')
                            .map((modpack) => (
                                <ModpackCard
                                    key={modpack.id}
                                    modpack={modpack}
                                    to={`/modpack/${modpack.id}`}
                                    className="h-full"
                                />
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
