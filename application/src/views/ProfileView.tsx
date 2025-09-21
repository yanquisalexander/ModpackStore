import { useAuthentication } from "@/stores/AuthContext";
import { TwitchLinkingComponent } from "@/components/TwitchLinkingComponent";
import { PatreonLinkingComponent } from "@/components/PatreonLinkingComponent";
import { LucideUser, LucideMail, LucideCalendar, LucideShield, LucideSettings, LucideChevronRight, LucideHelpCircle, LucideTicket, LucideCopy, LucideCheck, LucidePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useGlobalContext } from "@/stores/GlobalContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { DiscordIcon } from "@/icons/DiscordIcon";
import { Link, useLocation, Outlet } from "react-router-dom";
import { toast } from "sonner";

export const ProfileView = () => {
  const { session } = useAuthentication();
  const { setTitleBarState, titleBarState } = useGlobalContext();
  const location = useLocation();

  // Get current section from URL
  const getCurrentSection = () => {
    const path = location.pathname;

    // Map of URL patterns to section names
    const sectionMap: Record<string, string> = {
      '/integrations': 'integrations',
      '/tickets': 'tickets',
      '/help': 'help'
    };

    // Find matching section or default to 'profile'
    for (const [pattern, section] of Object.entries(sectionMap)) {
      if (path.endsWith(pattern)) {
        return section;
      }
    }

    return 'profile';
  };

  const activeSection = getCurrentSection();

  useEffect(() => {
    setTitleBarState({
      ...titleBarState,
      title: "Mi Perfil",
      canGoBack: true,
      icon: LucideUser,
      opaque: true,
      customIconClassName: "text-white"
    });
  }, []);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card className="h-fit">
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Profile Header */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <LucideUser className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Perfil de Usuario</h2>
                    <Badge variant="secondary" className="text-xs">
                      {session.role?.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Gestiona tu cuenta y integraciones
                  </p>
                </div>

                <Separator />

                {/* Quick Actions */}
                <nav className="space-y-2">
                  <Link
                    to="/profile"
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-lg transition-colors
                      ${activeSection === 'profile'
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted/50'
                      }
                    `}
                  >
                    <LucideUser className="h-4 w-4" />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">Información Personal</div>
                      <div className={`text-xs ${activeSection === 'profile' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                        Datos de tu cuenta
                      </div>
                    </div>
                    {activeSection === 'profile' && <LucideChevronRight className="h-4 w-4" />}
                  </Link>

                  <Link
                    to="/profile/integrations"
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-lg transition-colors
                      ${activeSection === 'integrations'
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted/50'
                      }
                    `}
                  >
                    <LucideSettings className="h-4 w-4" />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">Integraciones</div>
                      <div className={`text-xs ${activeSection === 'integrations' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                        Conecta tus cuentas
                      </div>
                    </div>
                    {activeSection === 'integrations' && <LucideChevronRight className="h-4 w-4" />}
                  </Link>

                  <Link
                    to="/profile/tickets"
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-lg transition-colors
                      ${activeSection === 'tickets'
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted/50'
                      }
                    `}
                  >
                    <LucideTicket className="h-4 w-4" />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">Mis Tickets</div>
                      <div className={`text-xs ${activeSection === 'tickets' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                        Soporte técnico
                      </div>
                    </div>
                    {activeSection === 'tickets' && <LucideChevronRight className="h-4 w-4" />}
                  </Link>

                  <Link
                    to="/profile/help"
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-lg transition-colors
                      ${activeSection === 'help'
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted/50'
                      }
                    `}
                  >
                    <LucideHelpCircle className="h-4 w-4" />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">Ayuda</div>
                      <div className={`text-xs ${activeSection === 'help' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                        Soporte y ayuda
                      </div>
                    </div>
                    {activeSection === 'help' && <LucideChevronRight className="h-4 w-4" />}
                  </Link>
                </nav>

                <Separator />

                {/* Quick Stats */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Estadísticas Rápidas</h3>

                  <div>
                    <div className="text-xs text-muted-foreground">Estado de Publisher</div>
                    <div className="text-sm font-medium">
                      {session.publisherMemberships && session.publisherMemberships.length > 0
                        ? `Publisher (${session.publisherMemberships.length} publisher${session.publisherMemberships.length > 1 ? 's' : ''})`
                        : 'Usuario Regular'
                      }
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">Tipo de Cuenta</div>
                    <div className="text-sm font-medium">
                      {session.isAdmin?.() ? 'Administrador' : 'Usuario Estándar'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

// Separate components for each section
export const ProfileInformation = () => {
  const { session } = useAuthentication();
  const [copiedId, setCopiedId] = useState(false);

  const copyUserId = async () => {
    if (!session?.id) return;

    try {
      await navigator.clipboard.writeText(session.id);
      setCopiedId(true);
      toast.success("ID copiado al portapapeles");
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      toast.error("Error al copiar el ID");
    }
  };

  if (!session) return null;

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
          <LucideUser size={20} />
          <span>Información del Perfil</span>
        </h2>

        <div className="flex items-center space-x-4 mb-6">
          <img
            src={session.avatarUrl}
            alt="Avatar"
            className="w-16 h-16 rounded-lg object-cover"
          />
          <div>
            <h3 className="text-lg font-medium">{session.username}</h3>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">ID de Usuario: {session.id}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyUserId}
                className="h-6 w-6 p-0"
              >
                {copiedId ? (
                  <LucideCheck className="h-3 w-3 text-green-600" />
                ) : (
                  <LucideCopy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3">
            <LucideMail className="text-muted-foreground" size={16} />
            <div>
              <div className="text-sm text-muted-foreground">Correo Electrónico</div>
              <div className="font-medium">{session.email}</div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <LucideCalendar className="text-muted-foreground" size={16} />
            <div>
              <div className="text-sm text-muted-foreground">Miembro desde</div>
              <div className="font-medium">
                {new Date(session.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <LucideShield className="text-muted-foreground" size={16} />
            <div>
              <div className="text-sm text-muted-foreground">Rol</div>
              <div className="font-medium capitalize">{session.role}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const IntegrationsSection = () => {
  const { session } = useAuthentication();

  if (!session) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Integraciones de Cuenta</h2>

      {/* Discord Integration Status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <DiscordIcon className="size-6 text-indigo-500" />
            <h3 className="text-lg font-semibold">Integración con Discord</h3>
          </div>

          <div className="flex items-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-green-400 font-medium">Conectado</span>
          </div>

          {session.discordId && (
            <div className="text-sm text-muted-foreground">
              ID de Discord: {session.discordId}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Twitch Integration */}
      <TwitchLinkingComponent />

      {/* Patreon Integration */}
      <PatreonLinkingComponent />

      {/* Legacy Patreon Integration Status (if available) */}
      {session.patreonId && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">P</span>
              </div>
              <h3 className="text-lg font-semibold">Integración con Patreon</h3>
            </div>

            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-green-400 font-medium">Conectado</span>
            </div>

            <div className="text-sm text-muted-foreground">
              ID de Patreon: {session.patreonId}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export const HelpSection = () => {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">¿Necesitas Ayuda?</h3>
        <p className="text-muted-foreground text-sm mb-4">
          ¿Tienes problemas con tus integraciones o configuración de cuenta?
        </p>
        <Button
          variant="outline"
          size="sm"
          asChild
        >
          <Link to="/profile/tickets">
            Ver Mis Tickets
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export const TicketsSection = () => {
  const { session } = useAuthentication();

  if (!session) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mis Tickets de Soporte</h2>
        <Button size="sm">
          <LucidePlus className="h-4 w-4 mr-2" />
          Nuevo Ticket
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <LucideTicket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No tienes tickets activos</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Cuando tengas problemas o necesites soporte, podrás crear tickets aquí.
            </p>
            <Button variant="outline" size="sm">
              Crear mi primer ticket
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};