import React, { useState } from 'react';
import { Crown, Upload, Trash2, ExternalLink, Star, Users, Calendar, Settings } from 'lucide-react';
import { useSocial } from '@/hooks/useSocial';
import { SocialProfileService, PatreonTier } from '@/services/socialProfile';
import { useToast } from '@/hooks/use-toast';

interface SocialProfilePanelProps {
  token?: string;
}

export const SocialProfilePanel: React.FC<SocialProfilePanelProps> = ({ token }) => {
  const { toast } = useToast();
  const {
    profile,
    patreonStatus,
    profileLoading,
    updateCoverImage,
    refreshProfile,
  } = useSocial(token);

  const [isEditingCover, setIsEditingCover] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState('');

  const handleUpdateCoverImage = async () => {
    if (!coverImageUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid image URL",
        variant: "destructive",
      });
      return;
    }

    if (!SocialProfileService.isValidImageUrl(coverImageUrl)) {
      toast({
        title: "Error",
        description: "Invalid image URL. Please use a supported image host.",
        variant: "destructive",
      });
      return;
    }

    await updateCoverImage(coverImageUrl);
    setIsEditingCover(false);
    setCoverImageUrl('');
  };

  const handleRemoveCoverImage = async () => {
    if (!token) return;

    try {
      await SocialProfileService.removeCoverImage(token);
      toast({
        title: "Success",
        description: "Cover image removed",
      });
      await refreshProfile();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove cover image",
        variant: "destructive",
      });
    }
  };

  const handleLinkPatreon = () => {
    const redirectUri = `${window.location.origin}/auth/patreon/callback`;
    const oauthUrl = SocialProfileService.getPatreonOAuthUrl(redirectUri);
    window.open(oauthUrl, '_blank');
  };

  const handleUnlinkPatreon = async () => {
    if (!token) return;

    try {
      await SocialProfileService.unlinkPatreon(token);
      toast({
        title: "Success",
        description: "Patreon account unlinked",
      });
      await refreshProfile();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unlink Patreon account",
        variant: "destructive",
      });
    }
  };

  const getTierColor = (tier: PatreonTier) => {
    switch (tier) {
      case PatreonTier.BASIC:
        return 'text-blue-600 bg-blue-100';
      case PatreonTier.PREMIUM:
        return 'text-purple-600 bg-purple-100';
      case PatreonTier.ELITE:
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getTierIcon = (tier: PatreonTier) => {
    switch (tier) {
      case PatreonTier.BASIC:
        return <Star className="w-3 h-3" />;
      case PatreonTier.PREMIUM:
        return <Crown className="w-3 h-3" />;
      case PatreonTier.ELITE:
        return <Crown className="w-3 h-3" />;
      default:
        return null;
    }
  };

  if (profileLoading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Cover Image Section */}
      <div className="relative">
        <div 
          className="h-32 bg-gradient-to-r from-primary/20 to-accent bg-cover bg-center"
          style={profile.coverImageUrl ? { backgroundImage: `url(${profile.coverImageUrl})` } : {}}
        >
          {patreonStatus?.canUploadCoverImage && (
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                onClick={() => setIsEditingCover(true)}
                className="p-1 bg-black bg-opacity-50 text-white rounded-md hover:bg-opacity-70 transition-opacity"
              >
                <Upload className="w-3 h-3" />
              </button>
              {profile.coverImageUrl && (
                <button
                  onClick={handleRemoveCoverImage}
                  className="p-1 bg-black bg-opacity-50 text-white rounded-md hover:bg-opacity-70 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Profile Avatar */}
        <div className="absolute -bottom-8 left-4">
          <img
            src={profile.avatarUrl || '/default-avatar.png'}
            alt={profile.username}
            className="w-16 h-16 rounded-full border-4 border-background"
          />
        </div>
      </div>

      {/* Profile Info */}
      <div className="pt-10 p-4">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold">{profile.username}</h2>
          {profile.isPatron && patreonStatus && (
            <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${getTierColor(patreonStatus.tier)}`}>
              {getTierIcon(patreonStatus.tier)}
              {patreonStatus.tier.toUpperCase()}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          {profile.friendsCount !== null && (
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{profile.friendsCount} friends</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Patreon Section */}
        <div className="border border-border rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Patreon Status</h3>
            <Settings className="w-4 h-4 text-muted-foreground" />
          </div>
          
          {profile.isPatron && patreonStatus ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status</span>
                <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${getTierColor(patreonStatus.tier)}`}>
                  {getTierIcon(patreonStatus.tier)}
                  {patreonStatus.tier.toUpperCase()} PATRON
                </span>
              </div>
              
              <div className="text-sm">
                <p className="font-medium mb-2">Premium Features:</p>
                <ul className="space-y-1 text-muted-foreground">
                  {patreonStatus.availableFeatures.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-primary rounded-full" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              
              <button
                onClick={handleUnlinkPatreon}
                className="w-full px-3 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
              >
                Unlink Patreon
              </button>
            </div>
          ) : (
            <div className="text-center">
              <Crown className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground mb-3">
                Link your Patreon account to unlock premium features
              </p>
              <button
                onClick={handleLinkPatreon}
                className="w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-3 h-3" />
                Link Patreon
              </button>
            </div>
          )}
        </div>

        {/* Premium Features Info */}
        {!profile.isPatron && (
          <div className="border border-dashed border-border rounded-lg p-4">
            <h4 className="font-medium mb-2">Premium Features</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Crown className="w-3 h-3" />
                <span>Custom profile cover images</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-3 h-3" />
                <span>Priority support</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-3 h-3" />
                <span>Early access to new features</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cover Image Edit Modal */}
      {isEditingCover && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg w-full max-w-md">
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold">Update Cover Image</h3>
            </div>
            
            <div className="p-4">
              <label className="block text-sm font-medium mb-2">Image URL</label>
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2 bg-accent border border-border rounded-md"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supported hosts: i.imgur.com, cdn.discordapp.com
              </p>
            </div>
            
            <div className="p-4 border-t border-border flex gap-2 justify-end">
              <button
                onClick={() => {
                  setIsEditingCover(false);
                  setCoverImageUrl('');
                }}
                className="px-4 py-2 text-sm bg-accent hover:bg-accent/80 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateCoverImage}
                disabled={!coverImageUrl.trim()}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};