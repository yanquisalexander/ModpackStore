import { API_ENDPOINT } from "@/consts";

/**
 * Track a modpack installation
 * This should be called whenever a user installs a modpack
 */
export async function trackModpackInstall(
  token: string,
  modpackId: string,
  versionId: string
): Promise<{ success: boolean; downloadId?: string; message?: string }> {
  try {
    const response = await fetch(`${API_ENDPOINT}/creators/track/install/${modpackId}/${versionId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to track modpack installation:', response.statusText);
      // Don't throw - tracking failure shouldn't block installation
      return { success: false, message: response.statusText };
    }

    const data = await response.json();
    return { success: data.success, downloadId: data.downloadId, message: data.message };
  } catch (error) {
    console.error('Error tracking modpack installation:', error);
    // Don't throw - tracking failure shouldn't block installation
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}
