import { API_ENDPOINT } from "@/consts";

export interface AcquisitionRecord {
    id: string;
    userId: string;
    modpackId: string;
    method: string;
    status: string;
    createdAt: string;
    updatedAt: string;
}

export interface ModpackBrief {
    id: string;
    name: string;
    slug: string;
    iconUrl: string;
    bannerUrl: string;
    creatorId: string;
    creatorName: string;
}

export interface AcquisitionItem {
    acquisition: AcquisitionRecord;
    modpack: ModpackBrief;
}

export interface UserAcquisitionsResponse {
    data: AcquisitionItem[];
}

export const getUserAcquisitions = async (
    accessToken: string,
): Promise<UserAcquisitionsResponse> => {
    const response = await fetch(
        `${API_ENDPOINT}/explore/user/acquisitions`,
        {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${accessToken}`
            }
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch user acquisitions: ${response.statusText}`);
    }

    const json = await response.json();
    return json;
};