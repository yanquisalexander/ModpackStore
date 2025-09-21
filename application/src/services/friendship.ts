import { API_ENDPOINT } from "@/consts";

// Type definitions for friendship
export interface FriendUser {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  coverImageUrl?: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  discordId?: string | null;
  patreonId?: string | null;
  twitchId?: string | null;
}

export interface FriendStatus {
  isOnline: boolean;
  currentModpack?: {
    id: string;
    name: string;
    iconUrl?: string | null;
  };
  lastActivity?: string;
}

export interface FriendWithStatus {
  user: FriendUser;
  status: FriendStatus;
}

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: string;
  updatedAt: string;
  requester?: FriendUser;
  addressee?: FriendUser;
}

export interface FriendshipStatus {
  areFriends: boolean;
  isBlocked: boolean;
  pendingRequest?: {
    id: string;
    requesterId: string;
    addresseeId: string;
  };
}

export interface FriendRequests {
  received: Array<{
    id: string;
    requester: FriendUser;
    createdAt: string;
  }>;
  sent: Array<{
    id: string;
    addressee: FriendUser;
    createdAt: string;
  }>;
}

export interface SearchResult {
  users: Array<FriendUser & { friendshipStatus: FriendshipStatus }>;
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
 * Send a friend request
 */
export async function sendFriendRequest(
  token: string,
  targetIdentifier: { userId?: string; username?: string; discordId?: string }
): Promise<{ friendshipId: string; status: string; message: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/friends/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetUserId: targetIdentifier.userId,
      targetUsername: targetIdentifier.username,
      targetDiscordId: targetIdentifier.discordId,
    }),
  });

  return await handleResponse<{ friendshipId: string; status: string; message: string }>(response);
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(
  token: string,
  friendshipId: string
): Promise<{ friendshipId: string; status: string; message: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/friends/accept`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ friendshipId }),
  });

  return await handleResponse<{ friendshipId: string; status: string; message: string }>(response);
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(
  token: string,
  friendshipId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/friends/decline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ friendshipId }),
  });

  return await handleResponse<{ message: string }>(response);
}

/**
 * Remove a friend
 */
export async function removeFriend(
  token: string,
  friendId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/friends/remove`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ friendId }),
  });

  return await handleResponse<{ message: string }>(response);
}

/**
 * Block a user
 */
export async function blockUser(
  token: string,
  targetUserId: string
): Promise<{ friendshipId: string; message: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/friends/block`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetUserId }),
  });

  return await handleResponse<{ friendshipId: string; message: string }>(response);
}

/**
 * Unblock a user
 */
export async function unblockUser(
  token: string,
  targetUserId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/friends/unblock`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetUserId }),
  });

  return await handleResponse<{ message: string }>(response);
}

/**
 * Get user's friends with their status
 */
export async function getFriends(token: string): Promise<{ friends: FriendWithStatus[] }> {
  const response = await fetch(`${API_ENDPOINT}/social/friends`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<{ friends: FriendWithStatus[] }>(response);
}

/**
 * Get pending friend requests
 */
export async function getPendingRequests(token: string): Promise<FriendRequests> {
  const response = await fetch(`${API_ENDPOINT}/social/friends/requests`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<FriendRequests>(response);
}

/**
 * Search for users to add as friends
 */
export async function searchUsers(token: string, query: string): Promise<SearchResult> {
  const response = await fetch(`${API_ENDPOINT}/social/friends/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<SearchResult>(response);
}

/**
 * Get friendship status with a specific user
 */
export async function getFriendshipStatus(
  token: string,
  userId: string
): Promise<FriendshipStatus> {
  const response = await fetch(`${API_ENDPOINT}/social/friends/status/${userId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<FriendshipStatus>(response);
}

// Friendship service object for convenience
export const FriendshipService = {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  getFriends,
  getPendingRequests,
  searchUsers,
  getFriendshipStatus,
};