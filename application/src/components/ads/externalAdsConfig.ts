export interface ExternalAdConfig {
    id: string;
    scriptSrc: string;
    containerId: string;
    placement: string;
    width?: string;
    height?: string;
    label?: string;
    native?: boolean;
    options?: Record<string, unknown>;
    weight?: number;
    scriptAttrs?: Record<string, string>;
}

export const externalAds: ExternalAdConfig[] = [
    {
        id: "adsterra-native-1x1",
        scriptSrc: "https://pl31260735.profitableratecpmnetwork.com/a40d8c1ec3644f1ce38250c2169d5697/invoke.js",
        containerId: "container-a40d8c1ec3644f1ce38250c2169d5697",
        placement: "explore_banner",
        height: "100px",
        native: true,
        weight: 1,
    },
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
    {
        id: "monetag-push",
        scriptSrc: "https://nap5k.com/tag.min.js",
        containerId: "monetag-push",
        placement: "explore_banner",
        scriptAttrs: { "data-zone": "11805758" },
        weight: 2,
    }
];
