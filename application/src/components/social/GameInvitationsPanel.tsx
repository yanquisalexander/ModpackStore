import React, { useState } from 'react';
import { Send, Clock, Check, X, Trash2, Mail } from 'lucide-react';
import { useSocial } from '@/hooks/useSocial';
import { InvitationStatus } from '@/services/gameInvitations';

interface GameInvitationsPanelProps {
  token?: string;
}

interface SendInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: any[];
  onSend: (receiverId: string, modpackId: string, message?: string) => void;
}

const SendInvitationModal: React.FC<SendInvitationModalProps> = ({ isOpen, onClose, friends, onSend }) => {
  const [selectedFriend, setSelectedFriend] = useState('');
  const [modpackId, setModpackId] = useState('');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSend = () => {
    if (selectedFriend && modpackId) {
      onSend(selectedFriend, modpackId, message || undefined);
      setSelectedFriend('');
      setModpackId('');
      setMessage('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-md">
        <div className="p-4 border-b border-border">
          <h3 className="text-lg font-semibold">Send Game Invitation</h3>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Friend</label>
            <select
              value={selectedFriend}
              onChange={(e) => setSelectedFriend(e.target.value)}
              className="w-full px-3 py-2 bg-accent border border-border rounded-md"
            >
              <option value="">Select a friend</option>
              {friends.map((friend) => (
                <option key={friend.user.id} value={friend.user.id}>
                  {friend.user.username}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Modpack ID</label>
            <input
              type="text"
              value={modpackId}
              onChange={(e) => setModpackId(e.target.value)}
              placeholder="Enter modpack ID"
              className="w-full px-3 py-2 bg-accent border border-border rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message..."
              rows={3}
              className="w-full px-3 py-2 bg-accent border border-border rounded-md resize-none"
            />
          </div>
        </div>
        
        <div className="p-4 border-t border-border flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-accent hover:bg-accent/80 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!selectedFriend || !modpackId}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
          >
            Send Invitation
          </button>
        </div>
      </div>
    </div>
  );
};

export const GameInvitationsPanel: React.FC<GameInvitationsPanelProps> = ({ token }) => {
  const {
    friends,
    pendingInvitations,
    sentInvitations,
    invitationsLoading,
    sendGameInvitation,
    respondToInvitation,
    refreshInvitations,
  } = useSocial(token);

  const [selectedView, setSelectedView] = useState<'received' | 'sent'>('received');
  const [showSendModal, setShowSendModal] = useState(false);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const formatExpiryTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((date.getTime() - now.getTime()) / (1000 * 60));

    if (diffInMinutes <= 0) return 'Expired';
    if (diffInMinutes < 60) return `${diffInMinutes}m left`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h left`;
    return `${Math.floor(diffInMinutes / 1440)}d left`;
  };

  const getStatusIcon = (status: InvitationStatus) => {
    switch (status) {
      case InvitationStatus.PENDING:
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case InvitationStatus.ACCEPTED:
        return <Check className="w-4 h-4 text-green-500" />;
      case InvitationStatus.DECLINED:
        return <X className="w-4 h-4 text-red-500" />;
      case InvitationStatus.EXPIRED:
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: InvitationStatus) => {
    switch (status) {
      case InvitationStatus.PENDING:
        return 'text-yellow-600 bg-yellow-100';
      case InvitationStatus.ACCEPTED:
        return 'text-green-600 bg-green-100';
      case InvitationStatus.DECLINED:
        return 'text-red-600 bg-red-100';
      case InvitationStatus.EXPIRED:
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const handleSendInvitation = async (receiverId: string, modpackId: string, message?: string) => {
    await sendGameInvitation(receiverId, modpackId, message);
  };

  const renderReceivedInvitations = () => (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm text-muted-foreground">
          RECEIVED INVITATIONS — {pendingInvitations.length}
        </h3>
      </div>

      {pendingInvitations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No pending invitations</p>
          <p className="text-xs mt-1">Game invitations from friends will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingInvitations.map((invitation) => (
            <div key={invitation.id} className="border border-border rounded-lg p-3 bg-accent/30">
              <div className="flex items-start gap-3">
                <img
                  src={invitation.sender?.avatarUrl || '/default-avatar.png'}
                  alt={invitation.sender?.username}
                  className="w-10 h-10 rounded-full"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">
                      {invitation.sender?.username}
                    </p>
                    {getStatusIcon(invitation.status)}
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <img
                      src={invitation.modpack?.iconUrl || '/default-modpack.png'}
                      alt={invitation.modpack?.name}
                      className="w-6 h-6 rounded"
                    />
                    <p className="text-sm text-muted-foreground truncate">
                      {invitation.modpack?.name}
                    </p>
                  </div>
                  
                  {invitation.message && (
                    <p className="text-sm text-muted-foreground mb-2 italic">
                      "{invitation.message}"
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatTimeAgo(invitation.createdAt)}</span>
                    <span className={`px-2 py-1 rounded-full ${getStatusColor(invitation.status)}`}>
                      {formatExpiryTime(invitation.expiresAt)}
                    </span>
                  </div>
                </div>
              </div>
              
              {invitation.status === InvitationStatus.PENDING && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => respondToInvitation(invitation.id, 'accept')}
                    className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-3 h-3" />
                    Accept
                  </button>
                  <button
                    onClick={() => respondToInvitation(invitation.id, 'decline')}
                    className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-3 h-3" />
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSentInvitations = () => (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm text-muted-foreground">
          SENT INVITATIONS — {sentInvitations.length}
        </h3>
        <button
          onClick={() => setShowSendModal(true)}
          className="px-3 py-2 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Send className="w-3 h-3" />
          Send
        </button>
      </div>

      {sentInvitations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No sent invitations</p>
          <p className="text-xs mt-1">Invite friends to play modpacks together</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sentInvitations.map((invitation) => (
            <div key={invitation.id} className="border border-border rounded-lg p-3">
              <div className="flex items-start gap-3">
                <img
                  src={invitation.receiver?.avatarUrl || '/default-avatar.png'}
                  alt={invitation.receiver?.username}
                  className="w-10 h-10 rounded-full"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">
                      {invitation.receiver?.username}
                    </p>
                    {getStatusIcon(invitation.status)}
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(invitation.status)}`}>
                      {invitation.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <img
                      src={invitation.modpack?.iconUrl || '/default-modpack.png'}
                      alt={invitation.modpack?.name}
                      className="w-6 h-6 rounded"
                    />
                    <p className="text-sm text-muted-foreground truncate">
                      {invitation.modpack?.name}
                    </p>
                  </div>
                  
                  {invitation.message && (
                    <p className="text-sm text-muted-foreground mb-2 italic">
                      "{invitation.message}"
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatTimeAgo(invitation.createdAt)}</span>
                    {invitation.status === InvitationStatus.PENDING && (
                      <span>{formatExpiryTime(invitation.expiresAt)}</span>
                    )}
                  </div>
                </div>

                {invitation.status === InvitationStatus.PENDING && (
                  <button
                    onClick={() => {
                      // Handle cancelling invitation
                      console.log('Cancel invitation:', invitation.id);
                    }}
                    className="p-1 rounded-md hover:bg-accent transition-colors text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
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
          onClick={() => setSelectedView('received')}
          className={`flex-1 py-2 px-3 text-sm font-medium transition-colors relative ${
            selectedView === 'received'
              ? 'text-primary border-b-2 border-primary bg-accent/50'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Received
          {pendingInvitations.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
              {pendingInvitations.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSelectedView('sent')}
          className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
            selectedView === 'sent'
              ? 'text-primary border-b-2 border-primary bg-accent/50'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Sent
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedView === 'received' ? renderReceivedInvitations() : renderSentInvitations()}
      </div>

      {/* Send Invitation Modal */}
      <SendInvitationModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        friends={friends}
        onSend={handleSendInvitation}
      />
    </div>
  );
};