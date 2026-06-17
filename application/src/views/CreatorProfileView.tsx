import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
    LucideGlobe,
    LucidePackage,
    LucideBadgeCheck,
    LucideShare2,
    LucideUsers,
    LucideMessageCircle,
    LucideArrowLeft,
    LucideLoader,
    LucideShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ModpackCard } from '@/components/ModpackCard';

import { useGlobalContext } from '@/stores/GlobalContext';
import { creatorSettingsService, CreatorProfileData } from '@/services/creatorSettings.service';

interface PublicCreatorData extends CreatorProfileData {
    modpacks: {
        id: string;
        name: string;
        slug: string;
        bannerUrl: string;
        visibility: string;
        shortDescription: string;
    }[];
    memberCount: number;
    modpackCount: number;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08 },
    },
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: 'spring' as const, stiffness: 100, damping: 20 },
    },
};

const LoadingSkeleton: React.FC = () => (
    <div className="w-full min-h-screen bg-[#0e0e10]">
        <div className="w-full h-[40vh] bg-neutral-900 animate-pulse" />
        <div className="max-w-7xl mx-auto px-6 -mt-20 pb-24 relative z-10">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end mb-8">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-[#0e0e10] bg-neutral-800 shrink-0 animate-pulse" />
                <div className="flex-1 pb-1 space-y-3 w-full">
                    <div className="h-4 w-28 bg-neutral-800 rounded animate-pulse" />
                    <div className="h-9 w-56 bg-neutral-800 rounded animate-pulse" />
                    <div className="flex gap-2">
                        <div className="h-8 w-24 bg-neutral-800 rounded-lg animate-pulse" />
                        <div className="h-8 w-24 bg-neutral-800 rounded-lg animate-pulse" />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-neutral-900 border border-white/[0.06] rounded-xl p-4 flex items-center gap-4 animate-pulse">
                        <div className="size-10 bg-neutral-800 rounded-lg" />
                        <div className="space-y-2 flex-1">
                            <div className="h-3 w-16 bg-neutral-800 rounded" />
                            <div className="h-4 w-20 bg-neutral-800 rounded" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="bg-neutral-900 border border-white/[0.06] rounded-xl p-6 mb-8 space-y-3 animate-pulse">
                <div className="h-5 w-36 bg-neutral-800 rounded-lg" />
                <div className="h-4 w-full bg-neutral-800/50 rounded-lg" />
                <div className="h-4 w-3/4 bg-neutral-800/50 rounded-lg" />
            </div>
            <div className="space-y-5">
                <div className="flex items-center gap-3">
                    <div className="h-6 w-44 bg-neutral-800 rounded-lg animate-pulse" />
                    <div className="h-5 w-7 bg-neutral-800 rounded-full animate-pulse" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="aspect-video bg-neutral-900 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    </div>
);

const NotFoundState: React.FC = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0e0e10] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5">
            <LucidePackage className="w-7 h-7 text-neutral-600" />
        </div>
        <p className="text-neutral-300 font-semibold text-base">Creator no encontrado</p>
        <p className="text-neutral-600 text-sm mt-1.5 max-w-md">
            El creator que buscas no existe o ha sido eliminado.
        </p>
        <Button
            variant="outline"
            className="mt-6 bg-white/5 border-white/10 hover:bg-white/10 text-neutral-300"
            onClick={() => window.history.back()}
        >
            <LucideArrowLeft className="mr-1.5 h-4 w-4" />
            Volver atrás
        </Button>
    </div>
);

export const CreatorProfileView: React.FC = () => {
    const { creatorSlug } = useParams<{ creatorSlug: string }>();
    const { setTitleBarState } = useGlobalContext();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<PublicCreatorData | null>(null);

    useEffect(() => {
        setTitleBarState({
            title: profile ? profile.displayName : 'Perfil de Creator',
            canGoBack: true,
            opaque: false,
            icon: profile?.logoUrl || undefined,

        });
    }, [profile, setTitleBarState]);

    useEffect(() => {
        loadProfile();
    }, [creatorSlug]);

    const loadProfile = async () => {
        if (!creatorSlug) return;
        setLoading(true);
        try {
            const data = await creatorSettingsService.getPublicProfile(creatorSlug);
            setProfile(data as unknown as PublicCreatorData);
        } catch (error) {
            console.error(error);
            toast.error('No se pudo cargar el perfil del creator');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <LoadingSkeleton />;
    if (!profile) return <NotFoundState />;

    const publicModpacks = profile.modpacks?.filter(m => m.visibility === 'public') ?? [];

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-[#0e0e10]">
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth relative">
                {/* Background Glows */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

                {/* Banner */}
                <div className="relative w-full h-[40vh] min-h-[320px] overflow-hidden">
                    <motion.div
                        initial={{ scale: 1.1, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="absolute inset-0"
                    >
                        {profile.bannerUrl ? (
                            <img
                                src={profile.bannerUrl}
                                alt=""
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-[#0e0e10] to-neutral-950" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e10] via-[#0e0e10]/40 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e10]/60 via-transparent to-[#0e0e10]/60" />
                    </motion.div>
                </div>

                {/* Content */}
                <motion.div
                    className="relative z-10 max-w-7xl mx-auto px-6 -mt-16 pb-24"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {/* Header Info */}
                    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-6 items-start sm:items-end mb-8">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.1 }}
                            className="relative shrink-0"
                        >
                            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-neutral-800 border-4 border-[#0e0e10] shadow-xl">
                                {profile.logoUrl ? (
                                    <img src={profile.logoUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 text-4xl font-bold text-neutral-500">
                                        {profile.displayName?.charAt(0)?.toUpperCase()}
                                    </div>
                                )}
                            </div>
                            {profile.partner && (
                                <div className="absolute -bottom-1.5 -right-1.5 bg-yellow-500/10 border border-yellow-500/30 backdrop-blur-md text-yellow-400 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-0.5">
                                    <LucideBadgeCheck size={10} /> Partner
                                </div>
                            )}
                        </motion.div>

                        <div className="flex-1 pb-1">
                            <div className="flex items-center gap-2 mb-1 text-neutral-400 font-medium text-sm">
                                <LucideGlobe className="size-3.5" />
                                <span>@{profile.slug}</span>
                            </div>
                            <div className="flex items-center gap-2 mb-4">
                                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                                    {profile.displayName}
                                </h1>
                                {profile.verified && (
                                    <LucideBadgeCheck className="size-7 text-blue-500 shrink-0" />
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    onClick={() => {
                                        navigator.clipboard.writeText(window.location.href);
                                        toast.success('Enlace copiado al portapapeles');
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="bg-white/5 border-white/10 hover:bg-white/10 hover:text-white transition-all text-neutral-300"
                                >
                                    <LucideShare2 className="mr-1.5 size-3.5" />
                                    Compartir
                                </Button>
                                {profile.discordUrl && (
                                    <a href={profile.discordUrl} target="_blank" rel="noopener noreferrer">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="bg-white/5 border-white/10 hover:bg-white/10 hover:text-white transition-all text-neutral-300"
                                        >
                                            <LucideMessageCircle className="mr-1.5 size-3.5" />
                                            Discord
                                        </Button>
                                    </a>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {/* Stats */}
                    <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                        <div className="bg-[#121214] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4">
                            <div className="p-2 bg-white/5 rounded-lg text-neutral-400">
                                <LucidePackage size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Modpacks</p>
                                <p className="text-sm font-semibold text-white">{profile.modpackCount}</p>
                            </div>
                        </div>
                        <div className="bg-[#121214] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4">
                            <div className="p-2 bg-white/5 rounded-lg text-neutral-400">
                                <LucideUsers size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Miembros</p>
                                <p className="text-sm font-semibold text-white">{profile.memberCount}</p>
                            </div>
                        </div>
                        <div className="bg-[#121214] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4 col-span-2 sm:col-span-1">
                            <div className="p-2 bg-white/5 rounded-lg text-neutral-400">
                                <LucideBadgeCheck size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Estado</p>
                                <p className="text-sm font-semibold text-white">
                                    {profile.verified ? 'Verificado' : profile.partner ? 'Partner' : 'Creator'}
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    {/* About */}
                    <motion.div variants={itemVariants}>
                        <div className="bg-[#121214] border border-white/[0.06] rounded-xl p-6">
                            <h3 className="text-sm font-bold text-neutral-300 mb-3">Sobre nosotros</h3>
                            {profile.description ? (
                                <p className="text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap max-w-3xl">
                                    {profile.description}
                                </p>
                            ) : (
                                <p className="text-sm text-neutral-500 italic">
                                    Este creator no ha añadido una descripción todavía.
                                </p>
                            )}
                        </div>
                    </motion.div>

                    {/* Modpacks */}
                    <motion.div variants={itemVariants} className="mt-10">
                        <div className="flex items-center gap-3 mb-6">
                            <h2 className="text-lg font-bold text-white">Modpacks Públicos</h2>
                            <span className="bg-white/10 text-neutral-300 text-xs px-2 py-0.5 rounded-full border border-white/10 font-medium">
                                {publicModpacks.length}
                            </span>
                        </div>

                        {publicModpacks.length > 0 ? (
                            <motion.div
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                            >
                                {publicModpacks.map((modpack) => (
                                    <motion.div key={modpack.id} variants={itemVariants}>
                                        <ModpackCard
                                            modpack={modpack}
                                            to={`/modpack/${modpack.id}`}
                                            className="h-full hover:ring-2 hover:ring-white/20 transition-all duration-300"
                                        />
                                    </motion.div>
                                ))}
                            </motion.div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-14 h-14 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                                    <LucidePackage className="w-7 h-7 text-neutral-600" />
                                </div>
                                <p className="text-neutral-300 font-semibold text-sm">Sin modpacks públicos</p>
                                <p className="text-neutral-600 text-xs mt-1">Este creator aún no ha publicado contenido.</p>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
};
