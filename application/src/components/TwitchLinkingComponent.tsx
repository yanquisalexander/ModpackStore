import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { LucideExternalLink, LucideUnlink, LucideTwitch } from 'lucide-react';

interface TwitchStatus {
  linked: boolean;
  twitchId?: string;
  twitchUsername?: string;
}

export const TwitchLinkingComponent = () => {
  const [twitchStatus, setTwitchStatus] = useState<TwitchStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // Fetch current Twitch status
  const fetchTwitchStatus = async () => {
    try {
      const response = await fetch('/api/v1/auth/twitch/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        const status = await response.json();
        setTwitchStatus(status);
      } else {
        console.error('Failed to fetch Twitch status');
      }
    } catch (error) {
      console.error('Error fetching Twitch status:', error);
    }
  };

  // Start Twitch OAuth flow
  const handleLinkTwitch = async () => {
    setLoading(true);
    try {
      await invoke('start_twitch_auth');
      toast.success('Twitch authorization started. Please complete the process in your browser.');
      
      // Poll for completion or listen for events
      // The Rust backend will emit events when the linking is complete
    } catch (error) {
      console.error('Error starting Twitch auth:', error);
      toast.error('Failed to start Twitch authorization');
    } finally {
      setLoading(false);
    }
  };

  // Unlink Twitch account
  const handleUnlinkTwitch = async () => {
    setUnlinking(true);
    try {
      const response = await fetch('/api/v1/auth/twitch/unlink', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setTwitchStatus({ linked: false });
        toast.success('Twitch account unlinked successfully');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to unlink Twitch account');
      }
    } catch (error) {
      console.error('Error unlinking Twitch:', error);
      toast.error('Failed to unlink Twitch account');
    } finally {
      setUnlinking(false);
    }
  };

  useEffect(() => {
    fetchTwitchStatus();

    // Listen for Twitch auth success events
    const handleTwitchAuthSuccess = () => {
      toast.success('Twitch account linked successfully!');
      fetchTwitchStatus(); // Refresh status
    };

    // Add event listener for Twitch auth events (you might need to adjust this based on your event system)
    window.addEventListener('twitch-auth-success', handleTwitchAuthSuccess);

    return () => {
      window.removeEventListener('twitch-auth-success', handleTwitchAuthSuccess);
    };
  }, []);

  if (!twitchStatus) {
    return (
      <div className="bg-neutral-800 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <LucideTwitch className="text-purple-400" size={24} />
          <h3 className="text-lg font-semibold text-white">Twitch Integration</h3>
        </div>
        <div className="text-neutral-400">Loading Twitch status...</div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-800 rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-4">
        <LucideTwitch className="text-purple-400" size={24} />
        <h3 className="text-lg font-semibold text-white">Twitch Integration</h3>
      </div>

      {twitchStatus.linked ? (
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-green-400 font-medium">Connected</span>
          </div>
          
          {twitchStatus.twitchId && (
            <div className="text-sm text-neutral-400 mb-4">
              Twitch ID: {twitchStatus.twitchId}
            </div>
          )}

          <p className="text-neutral-300 text-sm mb-4">
            Your Twitch account is connected. You can now access subscriber-only modpacks from creators you're subscribed to.
          </p>

          <Button
            onClick={handleUnlinkTwitch}
            disabled={unlinking}
            variant="destructive"
            size="sm"
            className="flex items-center space-x-2"
          >
            <LucideUnlink size={16} />
            <span>{unlinking ? 'Unlinking...' : 'Unlink Twitch'}</span>
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-2 h-2 bg-neutral-500 rounded-full"></div>
            <span className="text-neutral-400 font-medium">Not Connected</span>
          </div>

          <p className="text-neutral-300 text-sm mb-4">
            Link your Twitch account to access exclusive subscriber-only modpacks from your favorite creators.
          </p>

          <div className="space-y-2 mb-4">
            <div className="text-xs text-neutral-400">Benefits of linking your Twitch account:</div>
            <ul className="text-xs text-neutral-300 space-y-1 ml-4">
              <li>• Access subscriber-only modpacks</li>
              <li>• Support your favorite creators</li>
              <li>• Exclusive content and early access</li>
            </ul>
          </div>

          <Button
            onClick={handleLinkTwitch}
            disabled={loading}
            className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700"
            size="sm"
          >
            <LucideExternalLink size={16} />
            <span>{loading ? 'Connecting...' : 'Link Twitch Account'}</span>
          </Button>
        </div>
      )}
    </div>
  );
};