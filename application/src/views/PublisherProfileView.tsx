import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
    LucideGlobe,
    LucideMessageCircle,
    LucideTwitter,
    LucideInstagram,
    LucideYoutube,
    LucidePackage,
    LucideBadgeCheck,
    LucideLoader,
    LucideShare2,
    LucideUsers,
    LucideCalendar
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ModpackCard } from '@/components/ModpackCard';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useAuthentication } from '@/stores/AuthContext';
import { useGlobalContext } from '@/stores/GlobalContext';
import { publisherSettingsService, PublisherProfileData } from '@/services/publisherSettings.service';

// --- Interfaces ---
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
    joinedAt?: string; // Optional: would be cool to add "Member since"
}

// --- Components ---

const SocialButton = ({ icon: Icon, url, label }: { icon: any, url: string | null, label: string }) => {
    if (!url) return null;
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center p-3 rounded-xl bg-neutral-800/50 hover:bg-neutral-800 border border-white/5 hover:border-white/20 transition-all duration-200"
            title={label}
        >
            <Icon className="h-5 w-5 text-neutral-400 group-hover:text-white transition-colors" />
        </a>
    );
};

const StatItem = ({ icon: Icon, label, value }: { icon: any, label: string, value: string | number }) => (
    <div className="flex flex-col items-center justify-center p-4 bg-neutral-900/50 rounded-2xl border border-white/5">
        <Icon className="h-5 w-5 text-primary mb-1 opacity-80" />
        <span className="text-xl font-bold text-white">{value}</span>
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
    </div>
);

// --- Main View ---

export const PublisherProfileView: React.FC = () => {
    const { publisherSlug } = useParams<{ publisherSlug: string }>();
    const { setTitleBarState } = useGlobalContext();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<PublicPublisherData | null>(null);

    useEffect(() => {
        setTitleBarState({
            title: profile ? profile.publisherName : "Perfil de Editor",
            canGoBack: true,
            opaque: false // Dejamos que el banner maneje la transparencia inicial
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
            setProfile(data as any);
        } catch (error) {
            toast.error('No se pudo cargar el perfil del editor');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-neutral-950">
                <div className="flex flex-col items-center gap-4">
                    <LucideLoader className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-neutral-500 animate-pulse text-sm">Cargando perfil...</p>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-center p-4">
                <h2 className="text-2xl font-bold mb-2 text-white">Editor no encontrado</h2>
                <p className="text-neutral-400">El editor que buscas no existe o ha sido eliminado.</p>
                <Button variant="link" className="mt-4" onClick={() => window.history.back()}>
                    Volver atrás
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-neutral-950 text-neutral-100 pb-20 overflow-x-hidden">

            {/* --- Hero Section Immersiva --- */}
            <div className="relative w-full h-[450px] md:h-[500px] overflow-hidden">
                {/* Background Image con Gradient Mask */}
                <div className="absolute inset-0 z-0">
                    {profile.bannerUrl ? (
                        <motion.img
                            initial={{ scale: 1.1, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.8 }}
                            src={profile.bannerUrl}
                            alt="Banner"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-neutral-950 to-neutral-950" />
                    )}
                    {/* Gradientes de fusión */}
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/80 via-transparent to-neutral-950/80" />
                </div>

                {/* Contenido del Hero */}
                <div className="absolute bottom-0 left-0 w-full z-10 pb-12">
                    <div className="container mx-auto px-6 md:px-10">
                        <div className="flex flex-col md:flex-row items-end gap-8">

                            {/* Avatar Gigante */}
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="relative shrink-0"
                            >
                                <div className="w-32 h-32 md:w-48 md:h-48 rounded-3xl overflow-hidden bg-neutral-800 border-4 border-neutral-950 shadow-2xl ring-1 ring-white/10">
                                    {profile.logoUrl ? (
                                        <img src={profile.logoUrl} alt={profile.publisherName} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 text-4xl font-bold text-neutral-500">
                                            {profile.publisherName.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                {/* Partner Badge flotante */}
                                {profile.isPartner && (
                                    <div className="absolute -bottom-3 -right-3 bg-yellow-500/10 border border-yellow-500/50 backdrop-blur-md text-yellow-400 px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                                        <LucideBadgeCheck size={14} /> Partner
                                    </div>
                                )}
                            </motion.div>

                            {/* Info Principal */}
                            <div className="flex-1 mb-2">
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-lg">
                                            {profile.publisherName}
                                        </h1>
                                        {profile.isVerified && (
                                            <LucideBadgeCheck className="h-8 w-8 text-blue-500 fill-blue-500/10" />
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-6 text-neutral-400 text-sm font-medium">
                                        <span className="flex items-center gap-1.5">
                                            <LucideGlobe className="w-4 h-4" />
                                            @{profile.publisherSlug || "unknown"}
                                        </span>
                                        {/* Optional: Joined Date if available */}
                                        <span className="flex items-center gap-1.5">
                                            <LucideCalendar className="w-4 h-4" />
                                            Miembro desde 2025
                                        </span>
                                    </div>
                                </motion.div>
                            </div>

                            {/* Botón de Acción Principal */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex gap-3 mb-4"
                            >
                                <Button
                                    onClick={() => {
                                        navigator.clipboard.writeText(window.location.href);
                                        toast.success('Enlace copiado al portapapeles');
                                    }}
                                    variant="outline"
                                    className="bg-white/5 border-white/10 hover:bg-white/10 hover:text-white backdrop-blur-md transition-all"
                                >
                                    <LucideShare2 className="mr-2 h-4 w-4" />
                                    Compartir
                                </Button>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Layout de Contenido (Grid) --- */}
            <div className="container mx-auto px-4 md:px-10 mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

                    {/* COLUMNA IZQUIERDA (Info + Stats + Social) - Sticky en Desktop */}
                    <div className="lg:col-span-4 xl:col-span-3 space-y-6">

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            <StatItem
                                icon={LucidePackage}
                                value={profile.modpackCount}
                                label="Modpacks"
                            />
                            <StatItem
                                icon={LucideUsers}
                                value={profile.memberCount}
                                label="Seguidores"
                            />
                        </div>

                        {/* About Section */}
                        <div className="bg-neutral-900/30 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
                            <h3 className="text-lg font-semibold text-white mb-4">Sobre nosotros</h3>
                            <p className="text-neutral-400 text-sm leading-relaxed whitespace-pre-wrap">
                                {profile.description || "Este editor no ha añadido una descripción todavía."}
                            </p>
                        </div>

                        {/* Social Links */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1">Enlaces</h4>
                            <div className="flex flex-wrap gap-2">
                                <SocialButton icon={LucideGlobe} url={profile.websiteUrl} label="Website" />
                                <SocialButton icon={LucideMessageCircle} url={profile.discordUrl} label="Discord" />
                                <SocialButton icon={LucideTwitter} url={profile.twitterUrl} label="Twitter" />
                                <SocialButton icon={LucideYoutube} url={profile.youtubeUrl} label="YouTube" />
                                <SocialButton icon={LucideInstagram} url={null} label="Instagram" /> {/* Example null */}
                            </div>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA (Contenido Principal) */}
                    <div className="lg:col-span-8 xl:col-span-9">

                        {/* Filtros / Headers (Simulados) */}
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold text-white">Modpacks Públicos</h2>
                                <span className="bg-neutral-800 text-neutral-300 text-xs px-2 py-0.5 rounded-full border border-white/5">
                                    {profile.modpacks.filter(m => m.visibility === 'public').length}
                                </span>
                            </div>
                            {/* Aquí podrías poner un select de ordenamiento */}
                        </div>

                        {/* Grid de Modpacks */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                            {profile.modpacks
                                .filter(modpack => modpack.visibility === 'public')
                                .map((modpack, idx) => (
                                    <motion.div
                                        key={modpack.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <ModpackCard
                                            modpack={modpack}
                                            to={`/modpack/${modpack.id}`}
                                            className="h-full hover:ring-2 hover:ring-primary/50 transition-all duration-300"
                                        />
                                    </motion.div>
                                ))}

                            {/* Estado vacío si no hay modpacks */}
                            {profile.modpacks.filter(m => m.visibility === 'public').length === 0 && (
                                <div className="col-span-full py-16 text-center border border-dashed border-white/10 rounded-2xl bg-white/5">
                                    <LucidePackage className="h-12 w-12 text-neutral-600 mx-auto mb-3" />
                                    <h3 className="text-neutral-300 font-medium">Sin modpacks públicos</h3>
                                    <p className="text-neutral-500 text-sm mt-1">Este editor aún no ha publicado contenido.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};