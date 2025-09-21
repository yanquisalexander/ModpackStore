import { useState, useEffect, useCallback } from 'react';
import { useRealtime } from './useRealtime';
import { FriendshipService, FriendWithStatus, FriendRequests } from '@/services/friendship';
import { ActivityFeedService, ActivityFeedItem, UserStatus } from '@/services/activityFeed';
import { GameInvitationService, GameInvitation } from '@/services/gameInvitations';
import { SocialProfileService, SocialProfile, PatreonStatus } from '@/services/socialProfile';
import { useToast } from './use-toast';

interface UseSocialReturn {
  // Friends data
  friends: FriendWithStatus[];
  friendRequests: FriendRequests | null;
  friendsLoading: boolean;
  
  // Activity feed data
  activityFeed: ActivityFeedItem[];
  friendsStatus: UserStatus[];
  activityLoading: boolean;
  
  // Game invitations data
  pendingInvitations: GameInvitation[];
  sentInvitations: GameInvitation[];
  invitationsLoading: boolean;
  
  // Profile data
  profile: SocialProfile | null;
  patreonStatus: PatreonStatus | null;
  profileLoading: boolean;
  
  // Actions
  sendFriendRequest: (identifier: { userId?: string; username?: string; discordId?: string }) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  declineFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  
  sendGameInvitation: (receiverId: string, modpackId: string, message?: string) => Promise<void>;
  respondToInvitation: (invitationId: string, action: 'accept' | 'decline') => Promise<void>;
  
  updateOnlineStatus: (isOnline: boolean) => Promise<void>;
  updatePlayingStatus: (isPlaying: boolean, modpackId?: string) => Promise<void>;
  
  updateCoverImage: (imageUrl: string) => Promise<void>;
  
  // Refresh functions
  refreshFriends: () => Promise<void>;
  refreshActivityFeed: () => Promise<void>;
  refreshInvitations: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useSocial(token?: string): UseSocialReturn {
  const { toast } = useToast();
  
  // State
  const [friends, setFriends] = useState<FriendWithStatus[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequests | null>(null);
  const [friendsLoading, setFriendsLoading] = useState(false);
  
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [friendsStatus, setFriendsStatus] = useState<UserStatus[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  
  const [pendingInvitations, setPendingInvitations] = useState<GameInvitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<GameInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [patreonStatus, setPatreonStatus] = useState<PatreonStatus | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // WebSocket connection for real-time updates
  const { isConnected, on } = useRealtime(token);

  // Refresh functions
  const refreshFriends = useCallback(async () => {
    if (!token) return;
    
    setFriendsLoading(true);
    try {
      const [friendsData, requestsData] = await Promise.all([
        FriendshipService.getFriends(token),
        FriendshipService.getPendingRequests(token)
      ]);
      
      setFriends(friendsData.friends);
      setFriendRequests(requestsData);
    } catch (error) {
      console.error('Error refreshing friends:', error);
      toast({
        title: "Error",
        description: "Failed to load friends data",
        variant: "destructive",
      });
    } finally {
      setFriendsLoading(false);
    }
  }, [token]);

  const refreshActivityFeed = useCallback(async () => {
    if (!token) return;
    
    setActivityLoading(true);
    try {
      const [feedData, statusData] = await Promise.all([
        ActivityFeedService.getActivityFeed(token),
        ActivityFeedService.getFriendsStatus(token)
      ]);
      
      setActivityFeed(feedData.activities);
      setFriendsStatus(statusData.friends);
    } catch (error) {
      console.error('Error refreshing activity feed:', error);
      toast({
        title: "Error",
        description: "Failed to load activity feed",
        variant: "destructive",
      });
    } finally {
      setActivityLoading(false);
    }
  }, [token]);

  const refreshInvitations = useCallback(async () => {
    if (!token) return;
    
    setInvitationsLoading(true);
    try {
      const [pendingData, sentData] = await Promise.all([
        GameInvitationService.getPendingInvitations(token),
        GameInvitationService.getSentInvitations(token)
      ]);
      
      setPendingInvitations(pendingData.invitations);
      setSentInvitations(sentData.invitations);
    } catch (error) {
      console.error('Error refreshing invitations:', error);
      toast({
        title: "Error",
        description: "Failed to load invitations",
        variant: "destructive",
      });
    } finally {
      setInvitationsLoading(false);
    }
  }, [token]);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    
    setProfileLoading(true);
    try {
      const [profileData, patreonData] = await Promise.all([
        SocialProfileService.getProfile(token),
        SocialProfileService.getPatreonStatus(token)
      ]);
      
      setProfile(profileData.profile);
      setPatreonStatus(patreonData);
    } catch (error) {
      console.error('Error refreshing profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
    } finally {
      setProfileLoading(false);
    }
  }, [token]);

  // Action functions
  const sendFriendRequest = useCallback(async (identifier: { userId?: string; username?: string; discordId?: string }) => {
    if (!token) return;
    
    try {
      await FriendshipService.sendFriendRequest(token, identifier);
      toast({
        title: "Success",
        description: "Friend request sent!",
      });
      await refreshFriends();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send friend request",
        variant: "destructive",
      });
    }
  }, [token, refreshFriends]);

  const acceptFriendRequest = useCallback(async (friendshipId: string) => {
    if (!token) return;
    
    try {
      await FriendshipService.acceptFriendRequest(token, friendshipId);
      toast({
        title: "Success",
        description: "Friend request accepted!",
      });
      await refreshFriends();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to accept friend request",
        variant: "destructive",
      });
    }
  }, [token, refreshFriends]);

  const declineFriendRequest = useCallback(async (friendshipId: string) => {
    if (!token) return;
    
    try {
      await FriendshipService.declineFriendRequest(token, friendshipId);
      toast({
        title: "Success",
        description: "Friend request declined",
      });
      await refreshFriends();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to decline friend request",
        variant: "destructive",
      });
    }
  }, [token, refreshFriends]);

  const removeFriend = useCallback(async (friendId: string) => {
    if (!token) return;
    
    try {
      await FriendshipService.removeFriend(token, friendId);
      toast({
        title: "Success",
        description: "Friend removed",
      });
      await refreshFriends();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove friend",
        variant: "destructive",
      });
    }
  }, [token, refreshFriends]);

  const blockUser = useCallback(async (userId: string) => {
    if (!token) return;
    
    try {
      await FriendshipService.blockUser(token, userId);
      toast({
        title: "Success",
        description: "User blocked",
      });
      await refreshFriends();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to block user",
        variant: "destructive",
      });
    }
  }, [token, refreshFriends]);

  const sendGameInvitation = useCallback(async (receiverId: string, modpackId: string, message?: string) => {
    if (!token) return;
    
    try {
      await GameInvitationService.sendGameInvitation(token, receiverId, modpackId, message);
      toast({
        title: "Success",
        description: "Game invitation sent!",
      });
      await refreshInvitations();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invitation",
        variant: "destructive",
      });
    }
  }, [token, refreshInvitations]);

  const respondToInvitation = useCallback(async (invitationId: string, action: 'accept' | 'decline') => {
    if (!token) return;
    
    try {
      const result = await GameInvitationService.respondToInvitation(token, invitationId, action);
      toast({
        title: "Success",
        description: result.message,
      });
      
      // If accepted and needs to launch, you could emit a Tauri event here
      if (action === 'accept' && result.nextAction === 'launch') {
        // Handle launching the modpack
        console.log('Should launch modpack');
      }
      
      await refreshInvitations();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to respond to invitation",
        variant: "destructive",
      });
    }
  }, [token, refreshInvitations]);

  const updateOnlineStatus = useCallback(async (isOnline: boolean) => {
    if (!token) return;
    
    try {
      await ActivityFeedService.updateOnlineStatus(token, isOnline);
      await refreshActivityFeed();
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  }, [token, refreshActivityFeed]);

  const updatePlayingStatus = useCallback(async (isPlaying: boolean, modpackId?: string) => {
    if (!token) return;
    
    try {
      await ActivityFeedService.updatePlayingStatus(token, isPlaying, modpackId);
      await refreshActivityFeed();
    } catch (error) {
      console.error('Error updating playing status:', error);
    }
  }, [token, refreshActivityFeed]);

  const updateCoverImage = useCallback(async (imageUrl: string) => {
    if (!token) return;
    
    try {
      await SocialProfileService.updateCoverImage(token, imageUrl);
      toast({
        title: "Success",
        description: "Cover image updated!",
      });
      await refreshProfile();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update cover image",
        variant: "destructive",
      });
    }
  }, [token, refreshProfile]);

  // WebSocket event handlers
  useEffect(() => {
    if (!isConnected || !token) return;

    const unsubscribers = [
      // Friend events
      on('friend_request_received', () => refreshFriends()),
      on('friend_request_accepted', () => refreshFriends()),
      on('friendship_established', () => refreshFriends()),
      on('friendship_removed', () => refreshFriends()),
      
      // Game invitation events
      on('game_invitation_received', () => {
        refreshInvitations();
        toast({
          title: "Game Invitation",
          description: "You received a new game invitation!",
        });
      }),
      on('game_invitation_accepted', () => refreshInvitations()),
      on('game_invitation_declined', () => refreshInvitations()),
      
      // Activity events
      on('activity_update', () => refreshActivityFeed()),
      on('user_status_update', () => refreshActivityFeed()),
    ];

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [isConnected, token, on, refreshFriends, refreshInvitations, refreshActivityFeed]);

  // Initial data loading
  useEffect(() => {
    if (token) {
      refreshFriends();
      refreshActivityFeed();
      refreshInvitations();
      refreshProfile();
    }
  }, [token, refreshFriends, refreshActivityFeed, refreshInvitations, refreshProfile]);

  return {
    // Data
    friends,
    friendRequests,
    friendsLoading,
    activityFeed,
    friendsStatus,
    activityLoading,
    pendingInvitations,
    sentInvitations,
    invitationsLoading,
    profile,
    patreonStatus,
    profileLoading,
    
    // Actions
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockUser,
    sendGameInvitation,
    respondToInvitation,
    updateOnlineStatus,
    updatePlayingStatus,
    updateCoverImage,
    
    // Refresh functions
    refreshFriends,
    refreshActivityFeed,
    refreshInvitations,
    refreshProfile,
  };
}