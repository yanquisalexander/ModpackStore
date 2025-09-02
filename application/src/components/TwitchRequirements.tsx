import { LucideTwitch, LucideExternalLink, LucideLock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface TwitchRequirementsProps {
  requiresTwitchSubscription: boolean;
  requiredTwitchChannels: string[];
  userHasTwitchLinked: boolean;
  userCanAccess: boolean;
  className?: string;
}

export const TwitchRequirements = ({
  requiresTwitchSubscription,
  requiredTwitchChannels,
  userHasTwitchLinked,
  userCanAccess,
  className = ""
}: TwitchRequirementsProps) => {
  const navigate = useNavigate();

  if (!requiresTwitchSubscription) {
    return null;
  }

  const handleLinkTwitch = () => {
    navigate('/profile');
  };

  const getChannelUrl = (channelId: string) => {
    return `https://www.twitch.tv/${channelId}`;
  };

  return (
    <div className={`bg-purple-900/20 border border-purple-700/30 rounded-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <LucideTwitch size={16} className="text-white" />
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <LucideLock size={16} className="text-purple-400" />
            <h3 className="text-sm font-semibold text-purple-300">
              Twitch Subscriber Only
            </h3>
          </div>

          {userCanAccess ? (
            <div className="text-sm text-green-400 mb-2">
              ✓ You have access to this modpack
            </div>
          ) : (
            <div>
              {!userHasTwitchLinked ? (
                <div className="text-sm text-purple-200 mb-3">
                  Link your Twitch account to access this subscriber-only modpack.
                </div>
              ) : (
                <div className="text-sm text-purple-200 mb-3">
                  You need to be subscribed to at least one of the required channels to access this modpack.
                </div>
              )}
            </div>
          )}

          {requiredTwitchChannels.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-purple-300 mb-2">Required subscriptions:</div>
              <div className="space-y-1">
                {requiredTwitchChannels.map((channelId, index) => (
                  <div key={channelId} className="flex items-center justify-between text-sm">
                    <span className="text-purple-200">Channel: {channelId}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-purple-400 hover:text-purple-300 h-auto p-1"
                      onClick={() => window.open(getChannelUrl(channelId), '_blank')}
                    >
                      <LucideExternalLink size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!userCanAccess && (
            <div className="flex flex-wrap gap-2">
              {!userHasTwitchLinked && (
                <Button
                  onClick={handleLinkTwitch}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Link Twitch Account
                </Button>
              )}
              
              {requiredTwitchChannels.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-purple-600 text-purple-400 hover:bg-purple-600/10"
                  onClick={() => {
                    if (requiredTwitchChannels.length === 1) {
                      window.open(getChannelUrl(requiredTwitchChannels[0]), '_blank');
                    } else {
                      // Open first channel if multiple
                      window.open(getChannelUrl(requiredTwitchChannels[0]), '_blank');
                    }
                  }}
                >
                  Subscribe on Twitch
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};