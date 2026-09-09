import { useState, useEffect, useCallback } from "react";
import { API_ENDPOINT } from "@/consts";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useUserFlags } from "@/hooks/useUserFlags";

export interface AdData {
    id: string;
    name: string;
    type: "house" | "creator_modpack" | "creator_profile" | "external_sponsor";
    placement: string;
    title: string;
    subtitle: string | null;
    badgeText: string;
    ctaText: string;
    mediaUrl: string;
    targetModpackId: string | null;
    targetUrl: string | null;
    modpack?: {
        id: string;
        name: string;
        slug: string;
        iconUrl: string;
        bannerUrl: string;
    } | null;
    creator?: {
        id: string;
        name: string;
        slug: string;
        logoUrl: string | null;
    } | null;
}

export function useAd(placement: string) {
    const { flags, loading: flagsLoading } = useUserFlags();
    const [ad, setAd] = useState<AdData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const isAdFree = Boolean(flags?.ad_free);

    const fetchAd = useCallback(async () => {
        if (isAdFree) {
            setAd(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const res = await fetchWithAuth(`${API_ENDPOINT}/ads/serve?placement=${placement}`);
            if (!res.ok) {
                throw new Error(`Failed to fetch ad for placement: ${placement}`);
            }

            const json = await res.json();
            setAd(json.data || null);
        } catch (err: any) {
            console.warn(`[useAd] Placement ${placement} load error:`, err);
            setError(err);
            setAd(null);
        } finally {
            setLoading(false);
        }
    }, [placement, isAdFree]);

    useEffect(() => {
        if (flagsLoading) return;
        fetchAd();
    }, [fetchAd, flagsLoading]);

    const trackImpression = useCallback(async (campaignId: string) => {
        try {
            await fetchWithAuth(`${API_ENDPOINT}/ads/track/impression`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignId }),
            });
        } catch (e) {
            // Silently swallow analytics errors
        }
    }, []);

    const trackClick = useCallback(async (campaignId: string) => {
        try {
            await fetchWithAuth(`${API_ENDPOINT}/ads/track/click`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignId }),
            });
        } catch (e) {
            // Silently swallow analytics errors
        }
    }, []);

    return {
        ad,
        loading: loading || flagsLoading,
        error,
        isAdFree,
        trackImpression,
        trackClick,
        refetch: fetchAd,
    };
}
