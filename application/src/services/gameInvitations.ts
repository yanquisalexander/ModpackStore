import { API_ENDPOINT } from "@/consts";
import { FriendUser } from "./friendship";

// Type definitions for game invitations
export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired'
}

export interface GameInvitation {
  id: string;
  senderId: string;
  receiverId: string;
  modpackId: string;
  status: InvitationStatus;
  message?: string;
  expiresAt: string;
  createdAt: string;
  sender?: FriendUser;
  receiver?: FriendUser;
  modpack?: {
    id: string;
    name: string;
    iconUrl?: string | null;
  };
}

export interface ModpackStatus {
  hasModpack: boolean;
  isInstalled: boolean;
  isRunning: boolean;
}

export interface InvitationStats {
  totalPending: number;
  totalSent: number;
  recentActivity: {
    pending: Array<{
      id: string;
      sender: string;
      modpack: string;
      createdAt: string;
    }>;
    sent: Array<{
      id: string;
      receiver: string;
      modpack: string;
      status: InvitationStatus;
      createdAt: string;
    }>;
  };
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
 * Send a game invitation
 */
export async function sendGameInvitation(
  token: string,
  receiverId: string,
  modpackId: string,
  message?: string
): Promise<{ invitationId: string; message: string; expiresAt: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/invitations/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ receiverId, modpackId, message }),
  });

  return await handleResponse<{ invitationId: string; message: string; expiresAt: string }>(response);
}

/**
 * Respond to a game invitation
 */
export async function respondToInvitation(
  token: string,
  invitationId: string,
  action: 'accept' | 'decline'
): Promise<{
  invitation: { id: string; status: InvitationStatus };
  nextAction?: 'launch' | 'install' | 'download';
  message: string;
}> {
  const response = await fetch(`${API_ENDPOINT}/social/invitations/respond`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ invitationId, action }),
  });

  return await handleResponse<{
    invitation: { id: string; status: InvitationStatus };
    nextAction?: 'launch' | 'install' | 'download';
    message: string;
  }>(response);
}

/**
 * Get pending invitations for the current user
 */
export async function getPendingInvitations(token: string): Promise<{ invitations: GameInvitation[] }> {
  const response = await fetch(`${API_ENDPOINT}/social/invitations/pending`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<{ invitations: GameInvitation[] }>(response);
}

/**
 * Get sent invitations by the current user
 */
export async function getSentInvitations(token: string): Promise<{ invitations: GameInvitation[] }> {
  const response = await fetch(`${API_ENDPOINT}/social/invitations/sent`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<{ invitations: GameInvitation[] }>(response);
}

/**
 * Cancel a sent invitation
 */
export async function cancelInvitation(
  token: string,
  invitationId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_ENDPOINT}/social/invitations/${invitationId}/cancel`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<{ message: string }>(response);
}

/**
 * Check modpack status for invitation handling
 */
export async function checkModpackStatus(
  token: string,
  modpackId: string
): Promise<ModpackStatus> {
  const response = await fetch(`${API_ENDPOINT}/social/invitations/modpack/${modpackId}/status`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<ModpackStatus>(response);
}

/**
 * Get invitation statistics
 */
export async function getInvitationStats(token: string): Promise<InvitationStats> {
  const response = await fetch(`${API_ENDPOINT}/social/invitations/stats`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<InvitationStats>(response);
}

/**
 * Cleanup expired invitations (maintenance)
 */
export async function cleanupExpiredInvitations(
  token: string
): Promise<{ message: string; cleanedCount: number }> {
  const response = await fetch(`${API_ENDPOINT}/social/invitations/cleanup`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await handleResponse<{ message: string; cleanedCount: number }>(response);
}

// Game invitation service object for convenience
export const GameInvitationService = {
  sendGameInvitation,
  respondToInvitation,
  getPendingInvitations,
  getSentInvitations,
  cancelInvitation,
  checkModpackStatus,
  getInvitationStats,
  cleanupExpiredInvitations,
};