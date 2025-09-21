import { API_ENDPOINT } from "@/consts";
import { FriendUser, FriendStatus } from "./friendship";

// Type definitions for activity feed
export enum ActivityType {
  USER_ONLINE = 'user_online',
  USER_OFFLINE = 'user_offline',
  PLAYING_MODPACK = 'playing_modpack',
  STOPPED_PLAYING = 'stopped_playing',
  MODPACK_INSTALLED = 'modpack_installed',
  MODPACK_UNINSTALLED = 'modpack_uninstalled',
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
  FRIENDSHIP_CREATED = 'friendship_created'
}

export interface ActivityFeedItem {
  id: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  activityType: ActivityType;
  modpack?: {
    id: string;
    name: string;
    iconUrl: string | null;
  };
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface UserStatus extends FriendStatus {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

export interface ActivityStats {
  recentActivities: number;
  totalFriends: number;
  onlineFriends: number;
  playingFriends: number;
  currentlyPlaying: Array<{
    username: string;
    modpack?: string;
  }>;
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
 * Get the user's activity feed
 */
export async function getActivityFeed(
  token: string,
  limit: number = 50
): Promise<{ activities: ActivityFeedItem[]; total: number }> {
  const response = await fetch(`${API_ENDPOINT}/social/feed?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<{ activities: ActivityFeedItem[]; total: number }>(response);
}

/**
 * Get friends' current status
 */
export async function getFriendsStatus(token: string): Promise<{ friends: UserStatus[] }> {
  const response = await fetch(`${API_ENDPOINT}/social/feed/friends-status`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<{ friends: UserStatus[] }>(response);
}

/**
 * Update user's online status
 */
export async function updateOnlineStatus(
  token: string,
  isOnline: boolean
): Promise<{ message: string; status: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/status/online`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isOnline }),
  });

  return await handleResponse<{ message: string; status: string }>(response);
}

/**
 * Update user's playing status
 */
export async function updatePlayingStatus(
  token: string,
  isPlaying: boolean,
  modpackId?: string
): Promise<{ message: string; isPlaying: boolean; modpackId?: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/status/playing`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isPlaying, modpackId }),
  });

  return await handleResponse<{ message: string; isPlaying: boolean; modpackId?: string }>(response);
}

/**
 * Log modpack installation/uninstallation
 */
export async function logModpackAction(
  token: string,
  modpackId: string,
  action: 'install' | 'uninstall'
): Promise<{ message: string; action: string; modpackId: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/activities/modpack/${modpackId}?action=${action}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<{ message: string; action: string; modpackId: string }>(response);
}

/**
 * Log achievement unlock
 */
export async function logAchievement(
  token: string,
  achievementId: string,
  achievementName: string,
  modpackId?: string
): Promise<{ message: string; achievement: { id: string; name: string } }> {
  const response = await fetch(`${API_ENDPOINT}/social/activities/achievement`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ achievementId, achievementName, modpackId }),
  });

  return await handleResponse<{ message: string; achievement: { id: string; name: string } }>(response);
}

/**
 * Get current status of a specific user
 */
export async function getUserStatus(token: string, userId: string): Promise<UserStatus> {
  const response = await fetch(`${API_ENDPOINT}/social/status/${userId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<UserStatus>(response);
}

/**
 * Get user's own activities
 */
export async function getUserActivities(
  token: string,
  limit: number = 20
): Promise<{ activities: ActivityFeedItem[]; total: number }> {
  const response = await fetch(`${API_ENDPOINT}/social/activities/my?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<{ activities: ActivityFeedItem[]; total: number }>(response);
}

/**
 * Toggle activity visibility
 */
export async function toggleActivityVisibility(
  token: string,
  activityId: string,
  isVisible: boolean
): Promise<{ message: string; activityId: string; isVisible: boolean }> {
  const response = await fetch(`${API_ENDPOINT}/social/activities/visibility`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ activityId, isVisible }),
  });

  return await handleResponse<{ message: string; activityId: string; isVisible: boolean }>(response);
}

/**
 * Get activity feed statistics
 */
export async function getActivityStats(token: string): Promise<ActivityStats> {
  const response = await fetch(`${API_ENDPOINT}/social/feed/stats`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<ActivityStats>(response);
}

// Activity feed service object for convenience
export const ActivityFeedService = {
  getActivityFeed,
  getFriendsStatus,
  updateOnlineStatus,
  updatePlayingStatus,
  logModpackAction,
  logAchievement,
  getUserStatus,
  getUserActivities,
  toggleActivityVisibility,
  getActivityStats,
};