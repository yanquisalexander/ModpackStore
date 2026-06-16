import { log } from "@/lib/logger.ts";

interface TwitchChannel {
    id: string;
    username: string;
    displayName: string;
}

async function getTwitchAppToken(): Promise<string | null> {
    const clientId = Deno.env.get("TWITCH_CLIENT_ID");
    const clientSecret = Deno.env.get("TWITCH_CLIENT_SECRET");
    if (!clientId || !clientSecret) return null;

    try {
        const res = await fetch("https://id.twitch.tv/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "client_credentials",
            }),
        });

        if (!res.ok) return null;

        const data = await res.json();
        return data.access_token;
    } catch {
        return null;
    }
}

export async function searchTwitchChannels(query: string): Promise<TwitchChannel[]> {
    const clientId = Deno.env.get("TWITCH_CLIENT_ID");
    if (!clientId) return [];

    const token = await getTwitchAppToken();
    if (!token) return [];

    try {
        const res = await fetch(
            `https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(query)}&first=5`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Client-Id": clientId,
                },
            },
        );

        if (!res.ok) return [];

        const data = await res.json();
        return (data.data || []).map((ch: any) => ({
            id: ch.id,
            username: ch.broadcaster_login,
            displayName: ch.display_name,
        }));
    } catch (err) {
        log("[TWITCH] Search failed:", err);
        return [];
    }
}
