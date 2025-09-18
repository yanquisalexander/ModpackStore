import { API_ENDPOINT } from "@/consts";

export interface ModpackAcquisition {
    id: string;
    userId: string;
    modpackId: string;
    method: string;
    status: string;
    createdAt: string;
    modpack: {
        id: string;
        name: string;
        slug: string;
        shortDescription?: string;
        iconUrl: string;
        visibility: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        publisher?: {
            id: string;
            publisherName: string;
        };
    };
}

export interface UserAcquisitionsResponse {
    data: ModpackAcquisition[];
    meta: {
        page: number;
        totalPages: number;
        total: number;
    };
}

export const getUserAcquisitions = async (
    accessToken: string,
    page: number = 1,
    limit: number = 20
): Promise<UserAcquisitionsResponse> => {
    const url = new URL(`${API_ENDPOINT}/explore/user/acquisitions`);
    url.searchParams.append("page", page.toString());
    url.searchParams.append("limit", limit.toString());

    const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch user acquisitions: ${response.statusText}`);
    }

    const json = await response.json();
    return json;
};