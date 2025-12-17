import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, isAfter, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
    LucideSave,
    LucideLoader,
    LucideImage,
    LucideGlobe,
    LucideAlertCircle,
    LucideUpload
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

import { useAuthentication } from '@/stores/AuthContext';
import { publisherSettingsService } from '@/services/publisherSettings.service';
import { uploadFileWithUppy } from '@/utils/uppyUpload';
import { API_ENDPOINT } from '@/consts';

const profileSchema = z.object({
    publisherName: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(50),
    description: z.string().max(1000, "La descripción no puede exceder los 1000 caracteres").optional(),
    websiteUrl: z.string().url("URL inválida").optional().or(z.literal('')),
    discordUrl: z.string().url("URL inválida").optional().or(z.literal('')),
    twitterUrl: z.string().url("URL inválida").optional().or(z.literal('')),
    instagramUrl: z.string().url("URL inválida").optional().or(z.literal('')),
    youtubeUrl: z.string().url("URL inválida").optional().or(z.literal('')),
    tiktokUrl: z.string().url("URL inválida").optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export const PublisherSettingsView: React.FC = () => {
    const { publisherId } = useParams<{ publisherId: string }>();
    const { sessionTokens } = useAuthentication();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Image states
    const [logoUrl, setLogoUrl] = useState<string>('');
    const [bannerUrl, setBannerUrl] = useState<string>('');
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    // Cooldown state
    const [nameAvailableAt, setNameAvailableAt] = useState<Date | null>(null);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            publisherName: '',
            description: '',
            websiteUrl: '',
            discordUrl: '',
            twitterUrl: '',
            instagramUrl: '',
            youtubeUrl: '',
            tiktokUrl: '',
        },
    });

    useEffect(() => {
        if (publisherId && sessionTokens?.accessToken) {
            loadProfile();
        }
    }, [publisherId, sessionTokens?.accessToken]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const data = await publisherSettingsService.getProfile(publisherId!, sessionTokens!.accessToken);

            form.reset({
                publisherName: data.publisherName,
                description: data.description || '',
                websiteUrl: data.websiteUrl || '',
                discordUrl: data.discordUrl || '',
                twitterUrl: data.twitterUrl || '',
                instagramUrl: data.instagramUrl || '',
                youtubeUrl: data.youtubeUrl || '',
                tiktokUrl: data.tiktokUrl || '',
            });

            setLogoUrl(data.logoUrl || '');
            setBannerUrl(data.bannerUrl || '');

            if (data.nextNameChangeAvailable) {
                const availableDate = parseISO(data.nextNameChangeAvailable);
                if (isAfter(availableDate, new Date())) {
                    setNameAvailableAt(availableDate);
                }
            }
        } catch (error) {
            toast.error('Error al cargar el perfil');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (file: File, type: 'logo' | 'banner') => {
        const isLogo = type === 'logo';
        const setUploading = isLogo ? setUploadingLogo : setUploadingBanner;
        const setUrl = isLogo ? setLogoUrl : setBannerUrl;

        setUploading(true);
        try {
            const endpoint = `${API_ENDPOINT}/publishers/${publisherId}/upload/${type}`; // Ajustar endpoint según backend

            // Using existing uppy utility
            const response = await uploadFileWithUppy({
                file,
                endpoint: endpoint,
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`
                },
                formData: {
                    publisherId: publisherId!
                }
            });

            // The server response is wrapped in response.body by Uppy XHR Upload
            const responseBody = response.body;

            if (responseBody && responseBody.url) {
                setUrl(responseBody.url);
                toast.success(`${isLogo ? 'Logo' : 'Banner'} actualizado exitosamente`);
                // Reload profile to ensure consistency across the UI
                loadProfile();
            }
        } catch (error) {
            toast.error(`Error al subir ${isLogo ? 'logo' : 'banner'}`);
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    const onSubmit = async (values: ProfileFormValues) => {
        if (!publisherId || !sessionTokens?.accessToken) return;

        setSaving(true);
        try {
            await publisherSettingsService.updateProfile(publisherId, {
                ...values,
                logoUrl,
                bannerUrl
            }, sessionTokens.accessToken);

            toast.success('Perfil actualizado correctamente');
            // Refresh data to update cooldowns if name changed
            loadProfile();
        } catch (error) {
            toast.error('Error al guardar los cambios');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <LucideLoader className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const isNameDisabled = !!nameAvailableAt;

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            <div>
                <h1 className="text-2xl font-bold">Configuración del Perfil</h1>
                <p className="text-muted-foreground">Gestiona la información pública de tu organización.</p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Branding Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Branding</CardTitle>
                            <CardDescription>Personaliza la apariencia de tu página pública.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Banner Upload */}
                            <div className="space-y-2">
                                <FormLabel>Banner del Perfil</FormLabel>
                                <div className="relative aspect-[3/1] rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/25 bg-muted/50 group hover:border-primary/50 transition-colors">
                                    {bannerUrl ? (
                                        <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full gap-2">
                                            <LucideImage className="h-10 w-10 text-muted-foreground" />
                                            <p className="text-sm text-muted-foreground">Arrastra una imagen o haz click para subir</p>
                                        </div>
                                    )}
                                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${bannerUrl ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                                        <label className="cursor-pointer w-full h-full flex items-center justify-center">
                                            <Button asChild variant="secondary" size="sm" className="pointer-events-none">
                                                <div>
                                                    {uploadingBanner ? <LucideLoader className="mr-2 h-4 w-4 animate-spin" /> : <LucideUpload className="mr-2 h-4 w-4" />}
                                                    {uploadingBanner ? 'Subiendo...' : 'Cambiar Banner'}
                                                </div>
                                            </Button>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                disabled={uploadingBanner}
                                                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'banner')}
                                            />
                                        </label>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">Recomendado: 1500x500px. Máx 5MB.</p>
                            </div>

                            {/* Logo Upload */}
                            <div className="flex items-center gap-6">
                                <div className="space-y-2">
                                    <FormLabel>Logo</FormLabel>
                                    <div className="relative h-32 w-32 rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/25 bg-muted/50 group hover:border-primary/50 transition-colors">
                                        <div className="relative h-32 w-32 rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/25 bg-muted/50 group hover:border-primary/50 transition-colors">
                                            {logoUrl ? (
                                                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full gap-1">
                                                    <LucideImage className="h-6 w-6 text-muted-foreground" />
                                                    <span className="text-[10px] text-muted-foreground">Subir Logo</span>
                                                </div>
                                            )}

                                            {/* Loading Overlay */}
                                            {uploadingLogo && (
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                                    <LucideLoader className="h-8 w-8 text-white animate-spin" />
                                                </div>
                                            )}

                                            {/* Hover Overlay */}
                                            <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${logoUrl && !uploadingLogo ? 'opacity-0 group-hover:opacity-100' : (!logoUrl && !uploadingLogo) ? 'opacity-100' : 'opacity-0'} ${uploadingLogo ? 'hidden' : ''}`}>
                                                <label className="cursor-pointer p-0 m-0 w-full h-full flex items-center justify-center">
                                                    <div className="sr-only">Subir Logo</div>
                                                    <LucideUpload className="h-6 w-6 text-white" />
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept="image/*"
                                                        disabled={uploadingLogo}
                                                        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logo')}
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="publisherName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nombre del Publisher</FormLabel>
                                                <FormControl>
                                                    <Input {...field} disabled={isNameDisabled} />
                                                </FormControl>
                                                {isNameDisabled && nameAvailableAt && (
                                                    <p className="text-xs text-yellow-500 flex items-center gap-1 mt-1">
                                                        <LucideAlertCircle className="h-3 w-3" />
                                                        Podrás cambiar el nombre nuevamente el {format(nameAvailableAt, "d 'de' MMMM", { locale: es })}.
                                                    </p>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Descripción</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                {...field}
                                                placeholder="Cuéntanos sobre tu organización..."
                                                className="min-h-[100px] resize-none"
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Esta descripción aparecerá en tu perfil público.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>


                    {/* Social Links */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Redes Sociales</CardTitle>
                            <CardDescription>Conecta con tu comunidad.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="websiteUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2"><LucideGlobe className="h-4 w-4" /> Website</FormLabel>
                                        <FormControl><Input {...field} placeholder="https://..." /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="discordUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Discord</FormLabel>
                                        <FormControl><Input {...field} placeholder="https://discord.gg/..." /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="twitterUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Twitter / X</FormLabel>
                                        <FormControl><Input {...field} placeholder="https://twitter.com/..." /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="youtubeUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>YouTube</FormLabel>
                                        <FormControl><Input {...field} placeholder="https://youtube.com/..." /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={saving}>
                            {saving ? (
                                <>
                                    <LucideLoader className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <LucideSave className="mr-2 h-4 w-4" />
                                    Guardar Cambios
                                </>
                            )}
                        </Button>
                    </div>

                </form>
            </Form>
        </div>
    );
};
