import { API_ENDPOINT } from "@/consts";
import { FriendUser } from "./friendship";

// Type definitions for social profiles
export enum PatreonTier {
  NONE = 'none',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ELITE = 'elite'
}

export interface SocialProfile extends FriendUser {
  friendsCount: number | null;
  isPatron: boolean;
  patronTier: PatreonTier;
  canViewFullProfile: boolean;
}

export interface PatreonStatus {
  isPatron: boolean;
  tier: PatreonTier;
  isActive: boolean;
  entitledAmount: number;
  availableFeatures: string[];
  canUploadCoverImage: boolean;
}

export interface SocialStats {
  friendsCount: number;
  pendingRequestsCount: number;
  sentRequestsCount: number;
  joinDate: string;
  isPatron: boolean;
}

/**
 * Helper function to handle API responses.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  const json = await response.json();
  return json.data;
}

/**
 * Get user's social profile
 */
export async function getProfile(token: string, userId?: string): Promise<{ profile: SocialProfile }> {
  const url = userId
    ? `${API_ENDPOINT}/social/profile/${userId}`
    : `${API_ENDPOINT}/social/profile`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<{ profile: SocialProfile }>(response);
}

/**
 * Update user's cover image (Patreon feature)
 */
export async function updateCoverImage(
  token: string,
  coverImageUrl: string
): Promise<{ message: string; coverImageUrl: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/profile/cover-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ coverImageUrl }),
  });

  return await handleResponse<{ message: string; coverImageUrl: string }>(response);
}

/**
 * Remove user's cover image
 */
export async function removeCoverImage(token: string): Promise<{ message: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/profile/cover-image`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<{ message: string }>(response);
}

/**
 * Upload cover image file (Patreon feature)
 */
export async function uploadCoverImage(
  token: string,
  imageFile: File
): Promise<{ message: string; uploadUrl: string }> {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch(`${API_ENDPOINT}/social/profile/cover-image/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  return await handleResponse<{ message: string; uploadUrl: string }>(response);
}

/**
 * Get user's Patreon status and available features
 */
export async function getPatreonStatus(token: string): Promise<PatreonStatus> {
  const response = await fetch(`${API_ENDPOINT}/social/profile/patreon/status`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<PatreonStatus>(response);
}

/**
 * Link Patreon account
 */
export async function linkPatreon(
  token: string,
  code: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/profile/patreon/link`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  return await handleResponse<{ message: string }>(response);
}

/**
 * Unlink Patreon account
 */
export async function unlinkPatreon(token: string): Promise<{ message: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/profile/patreon/unlink`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<{ message: string }>(response);
}

/**
 * Get social statistics
 */
export async function getSocialStats(token: string, userId?: string): Promise<SocialStats> {
  const url = userId
    ? `${API_ENDPOINT}/social/profile/${userId}/stats`
    : `${API_ENDPOINT}/social/profile/stats`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<SocialStats>(response);
}

/**
 * Get Patreon OAuth URL for linking account
 */
export function getPatreonOAuthUrl(redirectUri: string): string {
  const clientId = process.env.PATREON_CLIENT_ID || 'your-patreon-client-id';
  const scopes = 'identity identity[email] identity.memberships';

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state: Math.random().toString(36).substring(7), // Simple state for CSRF protection
  });

  return `https://www.patreon.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Validate image URL for cover image
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    const isValidExtension = validExtensions.some(ext =>
      parsedUrl.pathname.toLowerCase().endsWith(ext)
    );

    return isValidExtension;
  } catch {
    return false;
  }
}

/**
 * Get premium features for a Patreon tier
 */
export function getPremiumFeaturesForTier(tier: PatreonTier): string[] {
  const features: Record<PatreonTier, string[]> = {
    [PatreonTier.NONE]: [],
    [PatreonTier.BASIC]: [
      'Custom cover image',
      'Priority support'
    ],
    [PatreonTier.PREMIUM]: [
      'Custom cover image',
      'Priority support',
      'Early access',
      'Exclusive modpacks'
    ],
    [PatreonTier.ELITE]: [
      'Custom cover image',
      'Priority support',
      'Early access',
      'Exclusive modpacks',
      'Custom badges',
      'Beta features'
    ]
  };

  return features[tier] || [];
}

// Social profile service object for convenience
export const SocialProfileService = {
  getProfile,
  updateCoverImage,
  removeCoverImage,
  uploadCoverImage,
  getPatreonStatus,
  linkPatreon,
  unlinkPatreon,
  getSocialStats,
  getPatreonOAuthUrl,
  isValidImageUrl,
  getPremiumFeaturesForTier,
};