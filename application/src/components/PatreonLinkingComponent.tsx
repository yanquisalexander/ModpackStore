import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { LucideExternalLink, LucideUnlink, Crown, Star, Users } from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from "@/consts";
import { listen } from "@tauri-apps/api/event";

interface PatreonStatus {
  isPatron: boolean;
  tier: string;
  isActive: boolean;
  entitledAmount: number;
  availableFeatures: string[];
  canUploadCoverImage: boolean;
}

interface PatreonConnectionStatus {
  connected: boolean;
  patreonStatus?: PatreonStatus;
}

export const PatreonLinkingComponent = () => {
  const [patreonStatus, setPatreonStatus] = useState<PatreonConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const { sessionTokens } = useAuthentication();

  // Fetch current Patreon status
  const fetchPatreonStatus = async () => {
    try {
      const token = sessionTokens?.accessToken;
      if (!token) {
        // Not authenticated locally — Patreon cannot be linked
        setPatreonStatus({ connected: false });
        return;
      }

      const response = await fetch(`${API_ENDPOINT}/social/profile/patreon/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const status = await response.json();
        console.log('Fetched Patreon status:', status);
        setPatreonStatus({
          connected: status.data.isPatron,
          patreonStatus: status.data
        });
      } else {
        console.error('Failed to fetch Patreon status');
        setPatreonStatus({ connected: false });
      }
    } catch (error) {
      console.error('Error fetching Patreon status:', error);
      setPatreonStatus({ connected: false });
    }
  };

  // Start Patreon OAuth flow
  const handleLinkPatreon = async () => {
    setLoading(true);
    try {
      await invoke('start_patreon_auth');
      toast.success('Patreon authorization started. Please complete the process in your browser.');

      // Poll for completion or listen for events
      // The Rust backend will emit events when the linking is complete
    } catch (error) {
      console.error('Error starting Patreon auth:', error);
      toast.error('Failed to start Patreon authorization');
    } finally {
      setLoading(false);
    }
  };

  // Unlink Patreon account
  const handleUnlinkPatreon = async () => {
    setUnlinking(true);
    try {
      const token = sessionTokens?.accessToken;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_ENDPOINT}/social/profile/patreon/unlink`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setPatreonStatus({ connected: false });
        toast.success('Tu cuenta de Patreon ha sido desvinculada con éxito');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'No se pudo desvincular la cuenta de Patreon');
      }
    } catch (error) {
      console.error('Error unlinking Patreon:', error);
      toast.error('No se pudo desvincular la cuenta de Patreon');
    } finally {
      setUnlinking(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'basic':
        return 'text-blue-400 bg-blue-900/30';
      case 'premium':
        return 'text-purple-400 bg-purple-900/30';
      case 'elite':
        return 'text-yellow-400 bg-yellow-900/30';
      default:
        return 'text-gray-400 bg-gray-900/30';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'basic':
        return <Star className="w-3 h-3" />;
      case 'premium':
      case 'elite':
        return <Crown className="w-3 h-3" />;
      default:
        return null;
    }
  };

  useEffect(() => {
    fetchPatreonStatus();

    // Listen for Patreon auth success events
    const handlePatreonAuthSuccess = () => {
      toast.success('Patreon account linked successfully!');
      fetchPatreonStatus(); // Refresh status
    };

    // listen returns a Promise<UnlistenFn>, keep the promise and call the returned unlisten function in cleanup
    const unlistenPromise = listen('patreon-auth-success', handlePatreonAuthSuccess);

    return () => {
      unlistenPromise
        .then((unlisten) => {
          try {
            unlisten();
          } catch (err) {
            console.error('Error during unlisten:', err);
          }
        })
        .catch((err) => {
          console.error('Failed to subscribe/listen to patreon-auth-success event:', err);
        });
    };
    // Re-run when tokens change so component reflects current authenticated user
  }, [sessionTokens]);

  if (!patreonStatus) {
    return (
      <div className="bg-neutral-800 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Crown className="text-[#ff424d] w-5 h-5" />
          <h3 className="text-lg font-semibold text-white">Integración de Patreon</h3>
        </div>
        <div className="text-neutral-400">Cargando estado de Patreon...</div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-800 rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-4">
        <Crown className="text-[#ff424d] w-5 h-5" />
        <h3 className="text-lg font-semibold text-white">Integración de Patreon</h3>
      </div>

      {patreonStatus.connected && patreonStatus.patreonStatus ? (
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-green-400 font-medium">Conectado</span>
            {patreonStatus.patreonStatus.tier !== 'none' && (
              <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${getTierColor(patreonStatus.patreonStatus.tier)}`}>
                {getTierIcon(patreonStatus.patreonStatus.tier)}
                {patreonStatus.patreonStatus.tier.toUpperCase()}
              </span>
            )}
          </div>

          <div className="text-sm text-neutral-400 mb-4">
            Estado: {patreonStatus.patreonStatus.isActive ? 'Activo' : 'Inactivo'}
            {patreonStatus.patreonStatus.entitledAmount > 0 && (
              <span className="ml-2">
                (${(patreonStatus.patreonStatus.entitledAmount / 100).toFixed(2)}/mes)
              </span>
            )}
          </div>

          <p className="text-neutral-300 text-sm mb-4">
            Tu cuenta de Patreon está conectada. Tienes acceso a las siguientes características premium:
          </p>

          {patreonStatus.patreonStatus.availableFeatures.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-neutral-400 mb-2">Características disponibles:</div>
              <ul className="text-xs text-neutral-300 space-y-1 ml-4">
                {patreonStatus.patreonStatus.availableFeatures.map((feature, index) => (
                  <li key={index}>• {feature}</li>
                ))}
              </ul>
            </div>
          )}

          <Button
            onClick={handleUnlinkPatreon}
            disabled={unlinking}
            variant="destructive"
            size="sm"
            className="flex items-center space-x-2"
          >
            <LucideUnlink size={16} />
            <span>{unlinking ? 'Desvinculando...' : 'Desvincular Patreon'}</span>
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-2 h-2 bg-neutral-500 rounded-full"></div>
            <span className="text-neutral-400 font-medium">No conectado</span>
          </div>

          <p className="text-neutral-300 text-sm mb-4">
            Vincula tu cuenta de Patreon para desbloquear características premium y apoyar el desarrollo del proyecto.
          </p>

          <div className="space-y-2 mb-4">
            <div className="text-xs text-neutral-400">Beneficios de vincular tu cuenta de Patreon:</div>
            <ul className="text-xs text-neutral-300 space-y-1 ml-4">
              <li>• Imágenes de portada de perfil personalizadas</li>
              <li>• Soporte prioritario</li>
              <li>• Acceso temprano a nuevas características</li>
              <li>• Modpacks exclusivos para patrocinadores</li>
              <li>• Insignias personalizadas (niveles superiores)</li>
            </ul>
          </div>

          <Button
            onClick={handleLinkPatreon}
            disabled={loading}
            className="flex items-center space-x-2 bg-[#ff424d] hover:bg-[#e63946]"
            size="sm"
          >
            <LucideExternalLink size={16} />
            <span>{loading ? 'Conectando...' : 'Conectar Patreon'}</span>
          </Button>
        </div>
      )}
    </div>
  );
};