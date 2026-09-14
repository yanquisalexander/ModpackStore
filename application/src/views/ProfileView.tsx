import { useAuthentication } from "@/stores/AuthContext";
import { TwitchLinkingComponent } from "@/components/TwitchLinkingComponent";
import { PatreonLinkingComponent } from "@/components/PatreonLinkingComponent";
import {
  LucideUser, LucideMail, LucideCalendar, LucideShield, LucideSettings,
  LucideTicket, LucideCopy, LucideCheck, LucideExternalLink, LucideLayoutGrid,
  LucideShirt
} from "lucide-react";
import { useEffect, useState } from "react";
import { useGlobalContext } from "@/stores/GlobalContext";
import { Button } from "@/components/ui/button";
import { DiscordIcon } from "@/icons/DiscordIcon";
import { Link, useLocation, Outlet } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const SidebarItem = ({ to, icon: Icon, label, isActive }: { to: string, icon: any, label: string, isActive: boolean }) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
      isActive ? "bg-white/[0.04] text-white" : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]"
    )}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </Link>
);

const InfoCard = ({ icon: Icon, label, value, subValue }: { icon: any, label: string, value: string, subValue?: string }) => (
  <div className="bg-black/20 border border-white/[0.04] rounded-lg p-4 flex items-start gap-3">
    <div className="p-2 rounded-md bg-white/[0.04] text-neutral-500">
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-medium text-neutral-600 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-white/90 truncate">{value}</p>
      {subValue && <p className="text-xs text-neutral-600 mt-0.5">{subValue}</p>}
    </div>
  </div>
);

export const ProfileInformation = () => {
  const { session } = useAuthentication();
  const [copiedId, setCopiedId] = useState(false);

  if (!session) return null;

  const copyUserId = async () => {
    if (!session.id) return;
    try {
      await navigator.clipboard.writeText(session.id);
      setCopiedId(true);
      toast.success("ID copiado");
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      toast.error("Error al copiar");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="relative overflow-hidden rounded-xl bg-[#121214] border border-white/[0.06] p-6 flex flex-col md:flex-row items-center gap-5 md:gap-6">

        <div className="relative shrink-0">
          <img
            src={session.avatarUrl || "https://github.com/shadcn.png"}
            alt="Avatar"
            className="relative w-20 h-20 rounded-full border-2 border-white/[0.06] object-cover"
          />
        </div>

        <div className="text-center md:text-left space-y-2 flex-1">
          <div className="flex flex-col md:flex-row items-center gap-2">
            <h2 className="text-xl font-bold text-white">{session.username}</h2>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06]">
              {session.role || "Usuario"}
            </span>
          </div>

          <div className="flex items-center gap-2 justify-center md:justify-start">
            <span className="text-xs text-neutral-600 font-mono">ID: {session.id}</span>
            <button onClick={copyUserId} className="text-neutral-600 hover:text-white transition-colors">
              {copiedId ? <LucideCheck className="w-3 h-3 text-green-500" /> : <LucideCopy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InfoCard
          icon={LucideMail}
          label="Correo Electrónico"
          value={session.email}
          subValue="Verificado"
        />
        <InfoCard
          icon={LucideCalendar}
          label="Miembro Desde"
          value={new Date(session.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
        />
        <InfoCard
          icon={LucideShield}
          label="Nivel de Acceso"
          value={session.isAdmin?.() ? 'Administrador Total' : 'Acceso Estándar'}
        />
        <InfoCard
          icon={LucideLayoutGrid}
          label="Publisher Status"
          value={session.creatorMemberships?.length ? `${session.creatorMemberships.length} Organizaciones` : 'Sin publicar'}
        />
      </div>
    </motion.div>
  );
};

export const IntegrationsSection = () => {
  const { session } = useAuthentication();
  if (!session) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="space-y-0.5">
        <h2 className="text-lg font-semibold text-white">Conexiones</h2>
        <p className="text-sm text-neutral-500">Gestiona las aplicaciones conectadas a tu cuenta.</p>
      </div>

      <div className="space-y-3">
        <div className="bg-[#121214] border border-white/[0.06] rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-[#5865F2]/20">
                <DiscordIcon className="w-5 h-5 text-[#5865F2]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Discord</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-xs text-green-400 font-medium">Conectado como {session.username}</span>
                </div>
              </div>
            </div>
            {session.discordId && (
              <span className="hidden sm:block text-xs font-mono text-neutral-600 bg-black/20 px-2 py-1 rounded">
                {session.discordId}
              </span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <TwitchLinkingComponent />
          <PatreonLinkingComponent />
        </div>
      </div>
    </motion.div>
  );
};

export const HelpSection = () => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full flex items-center justify-center min-h-[300px]">
    <div className="text-center space-y-4 max-w-md">
      <div className="mx-auto w-12 h-12 bg-white/[0.04] rounded-full flex items-center justify-center">
        <LucideTicket className="w-6 h-6 text-neutral-500" />
      </div>
      <h2 className="text-lg font-semibold text-white">Centro de Ayuda</h2>
      <p className="text-neutral-500 text-sm leading-relaxed">
        ¿Tienes problemas con tu cuenta o necesitas reportar un bug?
        Nuestro sistema de tickets está integrado para ayudarte.
      </p>
      <div className="pt-2">
        <Button asChild className="bg-white text-black hover:bg-white/90 text-sm font-semibold">
          <Link to="/profile/tickets">
            Abrir Ticket de Soporte <LucideExternalLink className="ml-2 w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  </motion.div>
);

export const ProfileView = () => {
  const { session } = useAuthentication();
  const { setTitleBarState, titleBarState } = useGlobalContext();
  const location = useLocation();

  const getActiveTab = () => {
    if (location.pathname.includes('/integrations')) return 'integrations';
    if (location.pathname.includes('/tickets')) return 'tickets';
    if (location.pathname.includes('/help')) return 'help';
    return 'profile';
  };
  const activeTab = getActiveTab();

  useEffect(() => {
    setTitleBarState({
      ...titleBarState,
      title: "Configuración",
      canGoBack: true,
      icon: LucideSettings,
      opaque: true,
      customIconClassName: "text-purple-400 bg-purple-500/10"
    });
  }, []);

  if (!session) return (
    <div className="min-h-full h-full flex items-center justify-center bg-[#0e0e10]">
      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-neutral-500" />
    </div>
  );

  return (
    <div className="min-h-full h-full bg-[#0e0e10] text-white">
      <div className="max-w-6xl mx-auto p-4 md:p-8">

        <div className="md:hidden mb-4">
          <h1 className="text-lg font-semibold text-white">Mi Cuenta</h1>
        </div>

        {/* Horizontal tabs en mobile, vertical sidebar en desktop */}
        <div className="flex md:block gap-2 overflow-x-auto md:overflow-visible mb-5 md:mb-0">
          <div className="flex md:hidden gap-1">
            <Link
              to="/profile"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors",
                activeTab === 'profile' ? "bg-white/[0.06] text-white" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              <LucideUser className="w-3.5 h-3.5" />
              Perfil
            </Link>
            <Link
              to="/profile/integrations"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors",
                activeTab === 'integrations' ? "bg-white/[0.06] text-white" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              <LucideLayoutGrid className="w-3.5 h-3.5" />
              Integraciones
            </Link>
            <Link
              to="/profile/skins"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors",
                activeTab === 'skins' ? "bg-white/[0.06] text-white" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              <LucideShirt className="w-3.5 h-3.5" />
              Skins
            </Link>
            <Link
              to="/profile/tickets"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors",
                activeTab === 'tickets' ? "bg-white/[0.06] text-white" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              <LucideTicket className="w-3.5 h-3.5" />
              Tickets
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          <div className="hidden md:block md:col-span-3 space-y-4">
            <nav className="space-y-0.5">
              <p className="px-3 text-[10px] font-medium text-neutral-600 uppercase tracking-wider mb-1.5">General</p>
              <SidebarItem
                to="/profile"
                icon={LucideUser}
                label="Perfil"
                isActive={activeTab === 'profile'}
              />
              <SidebarItem
                to="/profile/skins"
                icon={LucideShirt}
                label="Skins"
                isActive={activeTab === 'skins'}
              />
              <SidebarItem
                to="/profile/integrations"
                icon={LucideLayoutGrid}
                label="Integraciones"
                isActive={activeTab === 'integrations'}
              />
            </nav>

            <nav className="space-y-0.5">
              <p className="px-3 text-[10px] font-medium text-neutral-600 uppercase tracking-wider mb-1.5">Soporte</p>
              <SidebarItem
                to="/profile/tickets"
                icon={LucideTicket}
                label="Tickets"
                isActive={activeTab === 'tickets'}
              />
            </nav>
          </div>

          <div className="md:col-span-9">
            <div className="relative min-h-[400px]">
              <Outlet />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
