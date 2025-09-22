import React, { useState, useEffect, useRef } from 'react';
import { X, Users, MessageSquare, Activity, User } from 'lucide-react';
import { FriendsPanel } from './FriendsPanel';
import { ActivityFeedPanel } from './ActivityFeedPanel';
import { GameInvitationsPanel } from './GameInvitationsPanel';
import { SocialProfilePanel } from './SocialProfilePanel';

interface SocialPanelProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

type SocialTab = 'friends' | 'activity' | 'invitations' | 'profile';

export const SocialPanel: React.FC<SocialPanelProps> = ({ isOpen, onClose, token, anchorRef }) => {
  const [activeTab, setActiveTab] = useState<SocialTab>('activity');
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target) && !(anchorRef && anchorRef.current && anchorRef.current.contains(target))) {
        onClose();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'activity' as SocialTab, label: 'Actividad', icon: Activity },
    { id: 'friends' as SocialTab, label: 'Amigos', icon: Users },
    { id: 'invitations' as SocialTab, label: 'Invitaciones', icon: MessageSquare },
    { id: 'profile' as SocialTab, label: 'Perfil', icon: User },
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

  // Calculate position: align with anchor if available
  const style: React.CSSProperties = { right: 12, top: 48 };
  if (anchorRef && anchorRef.current) {
    const rect = anchorRef.current.getBoundingClientRect();
    style.top = rect.bottom + 6;
    style.right = window.innerWidth - rect.right - 6;
  }

  return (
    // Floating panel (no dark backdrop) placed near top-right like a dropdown
    <div ref={panelRef} className="fixed z-50 w-96 max-h-[80vh] bg-neutral-900/95 backdrop-blur-sm border border-neutral-700/60 shadow-2xl rounded-lg overflow-hidden" style={style}>
      <div className="flex flex-col h-full">
        {/* Decorative caret */}
        <div className="absolute -top-2 right-6 w-3 h-3 rotate-45 bg-neutral-900/95 border-t border-l border-neutral-700/60" />

        {/* Header */}
        <div className="flex items-center justify-between p-3  border-neutral-700/60">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">
              Panel Social
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-neutral-800/60 transition-colors text-white"
            aria-label="Cerrar panel social"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-700/60">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 text-sm font-medium transition-colors text-white ${activeTab === tab.id
                  ? 'border-b-2 border-primary bg-neutral-800/60'
                  : 'hover:bg-neutral-800/60'
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};