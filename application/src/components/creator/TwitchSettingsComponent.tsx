import { useState } from 'react';
import { LucideTwitch, LucidePlus, LucideX, LucideInfo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface TwitchSettingsProps {
  requiresTwitchSubscription: boolean;
  twitchCreatorIds: string[];
  onRequirementChange: (requires: boolean) => void;
  onCreatorIdsChange: (creatorIds: string[]) => void;
  disabled?: boolean;
}

export const TwitchSettingsComponent = ({
  requiresTwitchSubscription,
  twitchCreatorIds,
  onRequirementChange,
  onCreatorIdsChange,
  disabled = false
}: TwitchSettingsProps) => {
  const [newChannelId, setNewChannelId] = useState('');

  const addChannelId = () => {
    if (newChannelId.trim() && !twitchCreatorIds.includes(newChannelId.trim())) {
      onCreatorIdsChange([...twitchCreatorIds, newChannelId.trim()]);
      setNewChannelId('');
    }
  };

  const removeChannelId = (channelIdToRemove: string) => {
    onCreatorIdsChange(twitchCreatorIds.filter(id => id !== channelIdToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChannelId();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
          <LucideTwitch size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Twitch Subscription Requirements</h3>
          <p className="text-sm text-neutral-400">Control access to your modpack based on Twitch subscriptions</p>
        </div>
      </div>

      {/* Toggle for requiring Twitch subscription */}
      <div className="flex items-center justify-between p-4 bg-neutral-800 rounded-lg">
        <div className="space-y-1">
          <Label htmlFor="twitch-requirement" className="text-sm font-medium text-white">
            Require Twitch Subscription
          </Label>
          <p className="text-xs text-neutral-400">
            Only users subscribed to your Twitch channels can access this modpack
          </p>
        </div>
        <Switch
          id="twitch-requirement"
          checked={requiresTwitchSubscription}
          onCheckedChange={onRequirementChange}
          disabled={disabled}
        />
      </div>

      {/* Channel IDs configuration */}
      {requiresTwitchSubscription && (
        <div className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
            <div className="flex items-start space-x-2 mb-2">
              <LucideInfo size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-200">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Users must be subscribed to at least one of the specified Twitch channels</li>
                  <li>• Use the channel name (e.g., "channelname") or Twitch user ID</li>
                  <li>• Users will need to link their Twitch account to access the modpack</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="channel-ids" className="text-sm font-medium text-white mb-2 block">
              Required Twitch Channels
            </Label>
            <p className="text-xs text-neutral-400 mb-3">
              Add the Twitch channel names or IDs that users must be subscribed to
            </p>

            {/* Add new channel input */}
            <div className="flex space-x-2 mb-4">
              <Input
                id="channel-ids"
                value={newChannelId}
                onChange={(e) => setNewChannelId(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter Twitch channel name or ID"
                className="flex-1"
                disabled={disabled}
              />
              <Button
                onClick={addChannelId}
                disabled={!newChannelId.trim() || disabled}
                size="sm"
                className="px-3"
              >
                <LucidePlus size={16} />
              </Button>
            </div>

            {/* List of current channel IDs */}
            {twitchCreatorIds.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-neutral-400 mb-2">
                  Current required channels ({twitchCreatorIds.length}):
                </div>
                <div className="space-y-2">
                  {twitchCreatorIds.map((channelId, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-neutral-700 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center space-x-2">
                        <LucideTwitch size={14} className="text-purple-400" />
                        <span className="text-sm text-white font-mono">{channelId}</span>
                      </div>
                      <Button
                        onClick={() => removeChannelId(channelId)}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1 h-auto"
                        disabled={disabled}
                      >
                        <LucideX size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {twitchCreatorIds.length === 0 && requiresTwitchSubscription && (
              <div className="text-sm text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
                ⚠️ You must add at least one Twitch channel for the subscription requirement to work.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help text */}
      {requiresTwitchSubscription && (
        <div className="bg-neutral-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-2">Important Notes:</h4>
          <ul className="text-xs text-neutral-300 space-y-1">
            <li>• Users will see a subscription prompt before they can access your modpack</li>
            <li>• Subscription status is verified in real-time when users attempt to download</li>
            <li>• Users can link their Twitch account from their profile page</li>
            <li>• You can always disable this requirement later</li>
          </ul>
        </div>
      )}
    </div>
  );
};