import { useAuthentication } from "@/stores/AuthContext";
import { TwitchLinkingComponent } from "@/components/TwitchLinkingComponent";
import { PatreonLinkingComponent } from "@/components/PatreonLinkingComponent";
import {
  LucideUser, LucideMail, LucideCalendar, LucideShield, LucideSettings,
  LucideTicket, LucideCopy, LucideCheck, LucideExternalLink, LucideLayoutGrid,
  LucideShirt, LucideChevronRight, LucideCircleUserRound, LucideLoader2, type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useGlobalContext } from "@/stores/GlobalContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DiscordIcon } from "@/icons/DiscordIcon";
import { Link, NavLink, Outlet } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface ProfileNavItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const GENERAL_NAV: ProfileNavItem[] = [
  { to: "/profile", label: "Perfil", description: "Tus datos y cuenta", icon: LucideUser },
  { to: "/profile/skins", label: "Skins", description: "Tu aspecto en Minecraft", icon: LucideShirt },
  { to: "/profile/integrations", label: "Integraciones", description: "Twitch, Patreon y Discord", icon: LucideLayoutGrid },
];

const SUPPORT_NAV: ProfileNavItem[] = [
  { to: "/profile/tickets", label: "Tickets", description: "Soporte y ayuda", icon: LucideTicket },
];

const ProfileNavGroup = ({ title, items }: { title: string; items: ProfileNavItem[] }) => (
  <div className="space-y-1">
    <h3 className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
      {title}
    </h3>
    <nav className="space-y-1">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end>
          {({ isActive }) => (
            <span
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted/50",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block leading-none">{item.label}</span>
                <span
                  className={cn(
                    "block text-xs font-normal truncate mt-1",
                    isActive ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {item.description}
                </span>
              </span>
              {isActive && <LucideChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  </div>
);

const ProfileSidebar = ({ roleLabel }: { roleLabel: string }) => (
  <aside className="flex flex-col gap-4">
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
        <LucideCircleUserRound className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-sm truncate text-foreground">Mi Cuenta</h2>
      </div>
      <Badge variant="secondary" className="text-[10px] shrink-0 px-1.5">
        {roleLabel}
      </Badge>
    </div>

    <Separator />

    <ProfileNavGroup title="General" items={GENERAL_NAV} />
    <div className="pt-2 border-t border-border">
      <ProfileNavGroup title="Soporte" items={SUPPORT_NAV} />
    </div>
  </aside>
);

const InfoRow = ({ icon: Icon, label, value, subValue }: { icon: LucideIcon; label: string; value: string; subValue?: string }) => (
  <div className="flex items-center gap-3 py-3">
    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
      {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
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
      className="space-y-4"
    >
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <img
              src={session.avatarUrl || "https://github.com/shadcn.png"}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover ring-1 ring-border"
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground truncate">{session.username}</h2>
                <Badge variant="secondary" className="text-[10px]">
                  {session.role || "Usuario"}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs text-muted-foreground font-mono truncate">ID: {session.id}</span>
                <button onClick={copyUserId} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" aria-label="Copiar ID">
                  {copiedId ? <LucideCheck className="w-3 h-3 text-green-500" /> : <LucideCopy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="divide-y divide-border">
            <InfoRow
              icon={LucideMail}
              label="Correo electrónico"
              value={session.email}
              subValue="Verificado"
            />
            <InfoRow
              icon={LucideCalendar}
              label="Miembro desde"
              value={new Date(session.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            />
            <InfoRow
              icon={LucideShield}
              label="Nivel de acceso"
              value={session.isAdmin?.() ? 'Administrador total' : 'Acceso estándar'}
            />
            <InfoRow
              icon={LucideLayoutGrid}
              label="Publisher status"
              value={session.creatorMemberships?.length ? `${session.creatorMemberships.length} organizaciones` : 'Sin publicar'}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export const IntegrationsSection = () => {
  const { session } = useAuthentication();
  if (!session) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Conexiones</h2>
        <p className="text-sm text-muted-foreground">Gestiona las aplicaciones conectadas a tu cuenta.</p>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-[#5865F2]/10 text-[#5865F2] shrink-0">
              <DiscordIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-foreground">Discord</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground truncate">Conectado como {session.username}</span>
              </div>
            </div>
            {session.discordId && (
              <Badge variant="secondary" className="hidden sm:inline-flex font-mono font-normal shrink-0">
                {session.discordId}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <TwitchLinkingComponent />
        <PatreonLinkingComponent />
      </div>
    </motion.div>
  );
};

export const HelpSection = () => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    <Card>
      <CardContent className="p-8 text-center space-y-4 max-w-md mx-auto">
        <div className="mx-auto w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center">
          <LucideTicket className="w-6 h-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Centro de ayuda</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          ¿Tienes problemas con tu cuenta o necesitas reportar un bug?
          Nuestro sistema de tickets está integrado para ayudarte.
        </p>
        <div className="pt-2">
          <Button asChild>
            <Link to="/profile/tickets">
              Abrir ticket de soporte <LucideExternalLink className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const MOBILE_TABS = [
  { to: "/profile", label: "Perfil", icon: LucideUser, end: true },
  { to: "/profile/skins", label: "Skins", icon: LucideShirt, end: true },
  { to: "/profile/integrations", label: "Integraciones", icon: LucideLayoutGrid, end: true },
  { to: "/profile/tickets", label: "Tickets", icon: LucideTicket, end: true },
];

export const ProfileView = () => {
  const { session } = useAuthentication();
  const { setTitleBarState, titleBarState } = useGlobalContext();

  useEffect(() => {
    setTitleBarState({
      ...titleBarState,
      title: "Configuración",
      canGoBack: true,
      icon: LucideSettings,
      opaque: true,
      customIconClassName: "text-purple-400 bg-purple-500/10"
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session) return (
    <div className="min-h-full h-full flex items-center justify-center bg-background">
      <LucideLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const roleLabel = session.isAdmin?.() ? "ADMIN" : session.creatorMemberships?.length ? "CREATOR" : "USER";

  return (
    <div className="bg-background min-h-full h-full text-foreground">
      <div className="p-4 lg:p-6">
        <div className="flex md:hidden gap-1 overflow-x-auto mb-4">
          {MOBILE_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </NavLink>
          ))}
        </div>

        <div className="flex gap-6">
          <div className="hidden md:block w-64 shrink-0">
            <Card className="h-fit">
              <CardContent className="p-6">
                <ProfileSidebar roleLabel={roleLabel} />
              </CardContent>
            </Card>
          </div>

          <div className="flex-1 min-w-0">
            <div className="relative min-h-[400px]">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
