export interface ExternalAdConfig {
    id: string;
    scriptSrc: string;
    containerId?: string;
    placement: string | string[];
    width?: string;
    height?: string;
    label?: string;
    native?: boolean;
    format?: "adsterra" | "hilltopads" | "exoclick" | string;
    zoneId?: string;
    insClass?: string;
    settings?: Record<string, unknown>;
    options?: Record<string, unknown>;
    weight?: number;
    scriptAttrs?: Record<string, string>;
    renderMode?: "local" | "remote";
}

export const externalAds: ExternalAdConfig[] = [
    // ExoClick Banner (Zona #6040426 - Explore Banner y Sidebar)
    {
        id: "exoclick-6040426",
        scriptSrc: "https://a.magsrv.com/ad-provider.js",
        placement: ["explore_banner", "modpack_sidebar"],
        format: "exoclick",
        zoneId: "6040426",
        insClass: "eas6a97888e2",
        width: "300px",
        height: "250px",
        weight: 2,
    },

    // HilltopAds 300x250 (Zona #7460805 - Explore Banner y Sidebar)
    {
        id: "hilltopads-300x250",
        scriptSrc: "//juvenilechoice.com/b-XMV/sKd.GIlB0qYIWEcd/Xezm/9uu/Z/UgldkxPZToca0jNZjpA_4qMoD/UltwNJzpQS2bM/D/gfw/OTQC",
        containerId: "container-hilltopads-7460805",
        placement: ["explore_banner", "modpack_sidebar"],
        width: "300px",
        height: "250px",
        format: "hilltopads",
        weight: 2,
    },

    // Adsterra 728x90 (Banner principal en Explore)
    {
        id: "adsterra-728x90",
        scriptSrc: "https://www.highrevenueformat.com/3b96dc390e386e1b4cdcd2313dfa0570/invoke.js",
        containerId: "container-3b96dc390e386e1b4cdcd2313dfa0570",
        placement: "explore_banner",
        width: "728px",
        height: "90px",
        weight: 2,
        options: {
            key: "3b96dc390e386e1b4cdcd2313dfa0570",
            format: "iframe",
            height: 90,
            width: 728,
            params: {},
        },
    },

    // ── Anuncios comentados ──
    // Adsterra Native 1x1
    /*
    {
        id: "adsterra-native-1x1",
        scriptSrc: "https://pl31260735.profitableratecpmnetwork.com/a40d8c1ec3644f1ce38250c2169d5697/invoke.js",
        containerId: "container-a40d8c1ec3644f1ce38250c2169d5697",
        placement: "explore_banner",
        height: "100px",
        native: true,
        weight: 1,
    },
    */

    // Adsterra 300x250 (reemplazado por HilltopAds 300x250)
    /*
    {
        id: "adsterra-300x250",
        scriptSrc: "https://www.highrevenueformat.com/b537ccdc5ec66b9f28e4de33ebb0e2a4/invoke.js",
        containerId: "container-b537ccdc5ec66b9f28e4de33ebb0e2a4",
        placement: "modpack_sidebar",
        width: "300px",
        height: "250px",
        weight: 2,
        options: {
            key: "b537ccdc5ec66b9f28e4de33ebb0e2a4",
            format: "iframe",
            height: 250,
            width: 300,
            params: {},
        },
    },
    */
];
