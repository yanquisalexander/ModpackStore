export const API_ENDPOINT =
    import.meta.env.DEV || import.meta.env.MODE === "development"
        ? "https://api-modpackstore.alexitoo.dev/v1"
        : import.meta.env.VITE_API_ENDPOINT ||
        "https://api-modpackstore.saltouruguayserver.com/v1";



export const MICROSOFT_CLIENT_ID = "b999888a-cd19-4e13-8ca4-f276a9ba2a68";