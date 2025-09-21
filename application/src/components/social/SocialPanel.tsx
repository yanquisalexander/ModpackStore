import React, { useState } from 'react';
import { X, Users, MessageSquare, Activity, User } from 'lucide-react';
import { FriendsPanel } from './FriendsPanel';
import { ActivityFeedPanel } from './ActivityFeedPanel';
import { GameInvitationsPanel } from './GameInvitationsPanel';
import { SocialProfilePanel } from './SocialProfilePanel';

interface SocialPanelProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
}

type SocialTab = 'friends' | 'activity' | 'invitations' | 'profile';

export const SocialPanel: React.FC<SocialPanelProps> = ({ isOpen, onClose, token }) => {
  const [activeTab, setActiveTab] = useState<SocialTab>('activity');

  if (!isOpen) return null;

  const tabs = [
    { id: 'activity' as SocialTab, label: 'Activity', icon: Activity },
    { id: 'friends' as SocialTab, label: 'Friends', icon: Users },
    { id: 'invitations' as SocialTab, label: 'Invitations', icon: MessageSquare },
    { id: 'profile' as SocialTab, label: 'Profile', icon: User },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'activity':
        return <ActivityFeedPanel token={token} />;
      case 'friends':
        return <FriendsPanel token={token} />;
      case 'invitations':
        return <GameInvitationsPanel token={token} />;
      case 'profile':
        return <SocialProfilePanel token={token} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-end">
      <div className="w-96 h-full bg-background border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Social</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary bg-accent/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};