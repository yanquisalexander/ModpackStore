import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
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
    const [ads, setAds] = useState<AdData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);
    const [forceShowAds, setForceShowAds] = useState<boolean>(false);

    useEffect(() => {
        invoke<boolean>("get_config_value", { key: "forceShowAds" })
            .then((val) => setForceShowAds(Boolean(val)))
            .catch(() => {});
    }, []);

    const isAdFree = !forceShowAds && Boolean(flags?.ad_free);

    const fetchAd = useCallback(async () => {
        if (isAdFree) {
            setAd(null);
            setAds([]);
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
            const data = json.data;

            if (Array.isArray(data)) {
                setAds(data);
                setAd(data[0] || null);
            } else if (data) {
                setAds([data]);
                setAd(data);
            } else {
                setAds([]);
                setAd(null);
            }
        } catch (err: any) {
            console.warn(`[useAd] Placement ${placement} load error:`, err);
            setError(err);
            setAd(null);
            setAds([]);
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
        ads,
        loading: loading || flagsLoading,
        error,
        isAdFree,
        trackImpression,
        trackClick,
        refetch: fetchAd,
    };
}
