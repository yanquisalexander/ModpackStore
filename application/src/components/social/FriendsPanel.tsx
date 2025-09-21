import React, { useState } from 'react';
import { UserPlus, Search, Users, Mail, MoreHorizontal, UserCheck, UserMinus, UserX, MessageCircle } from 'lucide-react';
import { useSocial } from '@/hooks/useSocial';
import { FriendshipService } from '@/services/friendship';
import { useToast } from '@/hooks/use-toast';

interface FriendsPanelProps {
  token?: string;
}

export const FriendsPanel: React.FC<FriendsPanelProps> = ({ token }) => {
  const { toast } = useToast();
  const {
    friends,
    friendRequests,
    friendsLoading,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockUser,
    refreshFriends,
  } = useSocial(token);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedView, setSelectedView] = useState<'friends' | 'requests' | 'search'>('friends');
  const [showDropdown, setShowDropdown] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!token || searchQuery.trim().length < 2) return;

    setIsSearching(true);
    try {
      const results = await FriendshipService.searchUsers(token, searchQuery.trim());
      setSearchResults(results.users);
      setSelectedView('search');
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al buscar usuarios",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendFriendRequest = async (user: any) => {
    await sendFriendRequest({ userId: user.id });
    // Refresh search results to update friendship status
    await handleSearch();
  };

  const getFriendshipStatusText = (status: any) => {
    if (status.areFriends) return 'Amigos';
    if (status.isBlocked) return 'Bloqueado';
    if (status.pendingRequest) {
      return status.pendingRequest.requesterId === 'current-user-id'
        ? 'Solicitud enviada'
        : 'Solicitud recibida';
    }
    return null;
  };

  const getStatusColor = (friend: any) => {
    if (friend.status.currentModpack) return 'text-blue-500';
    if (friend.status.isOnline) return 'text-green-500';
    return 'text-gray-500';
  };

  const getStatusText = (friend: any) => {
    if (friend.status.currentModpack) return `Jugando ${friend.status.currentModpack.name}`;
    if (friend.status.isOnline) return 'En línea';
    return 'Desconectado';
  };

  const renderFriendsList = () => (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm text-muted-foreground">
          AMIGOS — {friends.length}
        </h3>
      </div>

      {friends.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aún no tienes amigos</p>
          <p className="text-xs mt-1">Busca usuarios para agregar como amigos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map((friend) => (
            <div key={friend.user.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors group">
              <div className="relative">
                <img
                  src={friend.user.avatarUrl || '/default-avatar.png'}
                  alt={friend.user.username}
                  className="w-10 h-10 rounded-full"
                />
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${friend.status.currentModpack ? 'bg-blue-500' : friend.status.isOnline ? 'bg-green-500' : 'bg-gray-500'
                  }`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{friend.user.username}</p>
                <p className={`text-xs truncate ${getStatusColor(friend)}`}>
                  {getStatusText(friend)}
                </p>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowDropdown(showDropdown === friend.user.id ? null : friend.user.id)}
                  className="p-1 rounded-md hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {showDropdown === friend.user.id && (
                  <div className="absolute right-0 mt-1 w-32 bg-popover border border-border rounded-md shadow-lg z-10">

                    <button
                      onClick={() => {
                        removeFriend(friend.user.id);
                        setShowDropdown(null);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent text-red-400 flex items-center gap-2"
                    >
                      <UserMinus className="w-3 h-3" />
                      Eliminar
                    </button>
                    <button
                      onClick={() => {
                        blockUser(friend.user.id);
                        setShowDropdown(null);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent text-red-400 flex items-center gap-2"
                    >
                      <UserX className="w-3 h-3" />
                      Bloquear
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderFriendRequests = () => (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm text-muted-foreground">SOLICITUDES DE AMISTAD</h3>
      </div>

      {!friendRequests || (friendRequests.received.length === 0 && friendRequests.sent.length === 0) ? (
        <div className="text-center py-8 text-muted-foreground">
          <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Sin solicitudes pendientes</p>
        </div>
      ) : (
        <div className="space-y-4">
          {friendRequests.received.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">RECIBIDAS</h4>
              <div className="space-y-2">
                {friendRequests.received.map((request) => (
                  <div key={request.id} className="flex items-center gap-3 p-2 rounded-md bg-accent/30">
                    <img
                      src={request.requester.avatarUrl || '/default-avatar.png'}
                      alt={request.requester.username}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{request.requester.username}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => acceptFriendRequest(request.id)}
                        className="p-1 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                      >
                        <UserCheck className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => declineFriendRequest(request.id)}
                        className="p-1 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        <UserX className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {friendRequests.sent.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">ENVIADAS</h4>
              <div className="space-y-2">
                {friendRequests.sent.map((request) => (
                  <div key={request.id} className="flex items-center gap-3 p-2 rounded-md bg-accent/30">
                    <img
                      src={request.addressee.avatarUrl || '/default-avatar.png'}
                      alt={request.addressee.username}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{request.addressee.username}</p>
                      <p className="text-xs text-muted-foreground">Solicitud pendiente</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderUserSearch = () => (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm text-muted-foreground">RESULTADOS DE BÚSQUEDA</h3>
      </div>

      {searchResults.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No se encontraron usuarios</p>
          <p className="text-xs mt-1">Intenta buscar con un nombre de usuario o ID de Discord diferente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {searchResults.map((user) => (
            <div key={user.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
              <img
                src={user.avatarUrl || '/default-avatar.png'}
                alt={user.username}
                className="w-8 h-8 rounded-full"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.username}</p>
                {user.discordId && (
                  <p className="text-xs text-muted-foreground truncate">Discord: {user.discordId}</p>
                )}
              </div>
              <div>
                {getFriendshipStatusText(user.friendshipStatus) ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-accent text-muted-foreground">
                    {getFriendshipStatusText(user.friendshipStatus)}
                  </span>
                ) : (
                  <button
                    onClick={() => handleSendFriendRequest(user)}
                    className="p-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <UserPlus className="w-3 h-3" />
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
      {/* Search Bar */}
      <div className="p-4 border-b border-border">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Buscar usuarios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-3 py-2 text-sm bg-accent rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || searchQuery.trim().length < 2}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* View Selector */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setSelectedView('friends')}
          className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${selectedView === 'friends'
            ? 'text-primary border-b-2 border-primary bg-accent/50'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Amigos
        </button>
        <button
          onClick={() => setSelectedView('requests')}
          className={`flex-1 py-2 px-3 text-sm font-medium transition-colors relative ${selectedView === 'requests'
            ? 'text-primary border-b-2 border-primary bg-accent/50'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Solicitudes
          {friendRequests && friendRequests.received.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {friendRequests.received.length}
            </span>
          )}
        </button>
        {searchResults.length > 0 && (
          <button
            onClick={() => setSelectedView('search')}
            className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${selectedView === 'search'
              ? 'text-primary border-b-2 border-primary bg-accent/50'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            Buscar
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedView === 'friends' && renderFriendsList()}
        {selectedView === 'requests' && renderFriendRequests()}
        {selectedView === 'search' && renderUserSearch()}
      </div>

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowDropdown(null)}
        />
      )}
    </div>
  );
};