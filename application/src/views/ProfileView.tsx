import { useAuthentication } from "@/stores/AuthContext";
import { TwitchLinkingComponent } from "@/components/TwitchLinkingComponent";
import { PatreonLinkingComponent } from "@/components/PatreonLinkingComponent";
import {
  LucideUser, LucideMail, LucideCalendar, LucideShield, LucideSettings,
  LucideTicket, LucideCopy, LucideCheck, LucideExternalLink, LucideLayoutGrid
} from "lucide-react";
import { useEffect, useState } from "react";
import { useGlobalContext } from "@/stores/GlobalContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiscordIcon } from "@/icons/DiscordIcon";
import { Link, useLocation, Outlet } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

// --- COMPONENTS ---

const SidebarItem = ({ to, icon: Icon, label, isActive }: { to: string, icon: any, label: string, isActive: boolean }) => (
  <Link to={to} className="relative group block w-full">
    {isActive && (
      <motion.div
        layoutId="active-profile-tab"
        className="absolute inset-0 bg-white/10 rounded-xl"
        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
      />
    )}
    <div className={cn(
      "relative flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-200",
      isActive ? "text-white" : "text-neutral-400 hover:text-white hover:bg-white/5"
    )}>
      <Icon className={cn("w-5 h-5", isActive ? "text-purple-400" : "text-neutral-500 group-hover:text-neutral-300")} />
      <span className="font-medium text-sm">{label}</span>
    </div>
  </Link>
);

const InfoCard = ({ icon: Icon, label, value, subValue }: { icon: any, label: string, value: string, subValue?: string }) => (
  <div className="bg-[#151515] border border-white/5 rounded-xl p-4 flex items-start gap-4 hover:border-white/10 transition-colors">
    <div className="p-2.5 rounded-lg bg-white/5 text-neutral-400">
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-white truncate">{value}</p>
      {subValue && <p className="text-xs text-neutral-500 mt-0.5">{subValue}</p>}
    </div>
  </div>
);

// --- SECTIONS ---

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
      className="space-y-6"
    >
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#121212] border border-white/10 p-8 flex flex-col md:flex-row items-center gap-6 md:gap-8">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 opacity-50" />

        {/* Avatar with Glow */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-purple-500/30 blur-2xl rounded-full" />
          <img
            src={session.avatarUrl || "https://github.com/shadcn.png"}
            alt="Avatar"
            className="relative w-24 h-24 rounded-full border-4 border-[#121212] shadow-xl object-cover"
          />
          <div className="absolute bottom-1 right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-[#121212]" title="Online" />
        </div>

        {/* User Info */}
        <div className="relative text-center md:text-left space-y-2 flex-1">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <h2 className="text-2xl font-bold text-white">{session.username}</h2>
            <Badge className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border-purple-500/50 uppercase text-[10px] tracking-wider px-2 py-0.5">
              {session.role || "Usuario"}
            </Badge>
          </div>

          <div className="flex items-center gap-2 justify-center md:justify-start bg-black/20 w-fit px-3 py-1 rounded-full border border-white/5 mx-auto md:mx-0">
            <span className="text-xs text-neutral-500 font-mono">ID: {session.id}</span>
            <button onClick={copyUserId} className="text-neutral-400 hover:text-white transition-colors">
              {copiedId ? <LucideCheck className="w-3 h-3 text-green-400" /> : <LucideCopy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-white">Conexiones</h2>
        <p className="text-sm text-neutral-400">Gestiona las aplicaciones conectadas a tu cuenta.</p>
      </div>

      <div className="grid gap-4">
        {/* Discord (Core) */}
        <div className="relative group overflow-hidden bg-[#151515] border border-indigo-500/20 rounded-xl p-6 transition-all hover:border-indigo-500/40">
          <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#5865F2]/20 rounded-xl text-[#5865F2]">
                <DiscordIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Discord</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
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

        {/* Other Integrations */}
        <div className="grid md:grid-cols-2 gap-4">
          <TwitchLinkingComponent />
          <PatreonLinkingComponent />
        </div>
      </div>
    </motion.div>
  );
};

export const HelpSection = () => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full flex items-center justify-center min-h-[400px]">
    <div className="text-center space-y-4 max-w-md">
      <div className="mx-auto w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
        <LucideTicket className="w-8 h-8 text-neutral-400" />
      </div>
      <h2 className="text-xl font-bold text-white">Centro de Ayuda</h2>
      <p className="text-neutral-400 text-sm leading-relaxed">
        ¿Tienes problemas con tu cuenta o necesitas reportar un bug?
        Nuestro sistema de tickets está integrado para ayudarte.
      </p>
      <div className="pt-4">
        <Button asChild className="bg-white text-black hover:bg-neutral-200">
          <Link to="/profile/tickets">
            Abrir Ticket de Soporte <LucideExternalLink className="ml-2 w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  </motion.div>
);

// --- MAIN LAYOUT ---

export const ProfileView = () => {
  const { session } = useAuthentication();
  const { setTitleBarState, titleBarState } = useGlobalContext();
  const location = useLocation();

  // Determine active tab
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
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-6xl mx-auto p-6 md:p-8">

        {/* Title Mobile */}
        <div className="md:hidden mb-6">
          <h1 className="text-2xl font-bold text-white">Mi Cuenta</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* SIDEBAR NAVIGATION */}
          <div className="lg:col-span-3 space-y-6">
            <nav className="space-y-1">
              <p className="px-4 text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">General</p>
              <SidebarItem
                to="/profile"
                icon={LucideUser}
                label="Perfil"
                isActive={activeTab === 'profile'}
              />
              <SidebarItem
                to="/profile/integrations"
                icon={LucideLayoutGrid}
                label="Integraciones"
                isActive={activeTab === 'integrations'}
              />
            </nav>

            <nav className="space-y-1">
              <p className="px-4 text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Soporte</p>
              <SidebarItem
                to="/profile/tickets"
                icon={LucideTicket}
                label="Tickets"
                isActive={activeTab === 'tickets'}
              />
              {/* Help is visually separate but kept here logic-wise */}
            </nav>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="lg:col-span-9">
            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-1 min-h-[600px] shadow-2xl relative overflow-hidden">
              {/* Decorative background blur */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/5 blur-[100px] rounded-full pointer-events-none" />

              <div className="relative p-6 md:p-8 h-full">
                <Outlet />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};