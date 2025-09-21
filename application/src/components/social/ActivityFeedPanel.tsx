import React, { useEffect, useState } from 'react';
import { RefreshCw, Circle, Gamepad2, Download, Trophy, Users, Clock } from 'lucide-react';
import { useSocial } from '@/hooks/useSocial';
import { ActivityFeedItem, ActivityType, UserStatus } from '@/services/activityFeed';

interface ActivityFeedPanelProps {
  token?: string;
}

export const ActivityFeedPanel: React.FC<ActivityFeedPanelProps> = ({ token }) => {
  const {
    activityFeed,
    friendsStatus,
    activityLoading,
    refreshActivityFeed,
  } = useSocial(token);

  const [selectedView, setSelectedView] = useState<'feed' | 'status'>('status');

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case ActivityType.USER_ONLINE:
        return <Circle className="w-4 h-4 text-green-500 fill-current" />;
      case ActivityType.USER_OFFLINE:
        return <Circle className="w-4 h-4 text-gray-500 fill-current" />;
      case ActivityType.PLAYING_MODPACK:
        return <Gamepad2 className="w-4 h-4 text-blue-500" />;
      case ActivityType.STOPPED_PLAYING:
        return <Gamepad2 className="w-4 h-4 text-gray-500" />;
      case ActivityType.MODPACK_INSTALLED:
        return <Download className="w-4 h-4 text-green-600" />;
      case ActivityType.MODPACK_UNINSTALLED:
        return <Download className="w-4 h-4 text-red-600" />;
      case ActivityType.ACHIEVEMENT_UNLOCKED:
        return <Trophy className="w-4 h-4 text-yellow-500" />;
      case ActivityType.FRIENDSHIP_CREATED:
        return <Users className="w-4 h-4 text-purple-500" />;
      default:
        return <Circle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityText = (activity: ActivityFeedItem) => {
    switch (activity.activityType) {
      case ActivityType.USER_ONLINE:
        return `${activity.user.username} came online`;
      case ActivityType.USER_OFFLINE:
        return `${activity.user.username} went offline`;
      case ActivityType.PLAYING_MODPACK:
        return `${activity.user.username} is playing ${activity.modpack?.name}`;
      case ActivityType.STOPPED_PLAYING:
        return `${activity.user.username} stopped playing ${activity.modpack?.name}`;
      case ActivityType.MODPACK_INSTALLED:
        return `${activity.user.username} installed ${activity.modpack?.name}`;
      case ActivityType.MODPACK_UNINSTALLED:
        return `${activity.user.username} uninstalled ${activity.modpack?.name}`;
      case ActivityType.ACHIEVEMENT_UNLOCKED:
        return `${activity.user.username} unlocked ${activity.metadata?.achievementName}`;
      case ActivityType.FRIENDSHIP_CREATED:
        return `${activity.user.username} became friends with ${activity.metadata?.friendUsername}`;
      default:
        return `${activity.user.username} did something`;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getStatusColor = (status: UserStatus) => {
    if (status.currentModpack) return 'text-blue-500';
    if (status.isOnline) return 'text-green-500';
    return 'text-gray-500';
  };

  const getStatusText = (status: UserStatus) => {
    if (status.currentModpack) return `Playing ${status.currentModpack.name}`;
    if (status.isOnline) return 'Online';
    return 'Offline';
  };

  const renderFriendsStatus = () => (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm text-muted-foreground">FRIENDS STATUS</h3>
        <span className="text-xs text-muted-foreground">
          {friendsStatus.filter(f => f.isOnline).length} online
        </span>
      </div>
      
      {friendsStatus.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No friends yet</p>
          <p className="text-xs mt-1">Add friends to see their status</p>
        </div>
      ) : (
        <div className="space-y-2">
          {friendsStatus.map((friend) => (
            <div key={friend.userId} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
              <div className="relative">
                <img
                  src={friend.avatarUrl || '/default-avatar.png'}
                  alt={friend.username}
                  className="w-8 h-8 rounded-full"
                />
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${
                  friend.currentModpack ? 'bg-blue-500' : friend.isOnline ? 'bg-green-500' : 'bg-gray-500'
                }`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{friend.username}</p>
                <p className={`text-xs truncate ${getStatusColor(friend)}`}>
                  {getStatusText(friend)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderActivityFeed = () => (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm text-muted-foreground">RECENT ACTIVITY</h3>
        <button
          onClick={refreshActivityFeed}
          disabled={activityLoading}
          className="p-1 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${activityLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {activityFeed.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recent activity</p>
          <p className="text-xs mt-1">Friend activities will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activityFeed.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
              <div className="flex-shrink-0 mt-1">
                {getActivityIcon(activity.activityType)}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm">{getActivityText(activity)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTimeAgo(activity.createdAt)}
                </p>
              </div>
              
              {activity.modpack && (
                <div className="flex-shrink-0">
                  <img
                    src={activity.modpack.iconUrl || '/default-modpack.png'}
                    alt={activity.modpack.name}
                    className="w-6 h-6 rounded"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* View Selector */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setSelectedView('status')}
          className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
            selectedView === 'status'
              ? 'text-primary border-b-2 border-primary bg-accent/50'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Status
        </button>
        <button
          onClick={() => setSelectedView('feed')}
          className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
            selectedView === 'feed'
              ? 'text-primary border-b-2 border-primary bg-accent/50'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Activity
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedView === 'status' ? renderFriendsStatus() : renderActivityFeed()}
      </div>
    </div>
  );
};