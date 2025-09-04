import { useAuthentication } from "@/stores/AuthContext";
import { TwitchLinkingComponent } from "@/components/TwitchLinkingComponent";
import { LucideUser, LucideMail, LucideCalendar, LucideShield, LucideSettings, LucideChevronRight, LucideHelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useGlobalContext } from "@/stores/GlobalContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { MdiTwitch } from "@/icons/MdiTwitch";
import { DiscordIcon } from "@/icons/DiscordIcon";

type ActiveSection = 'profile' | 'integrations' | 'help';

export const ProfileView = () => {
  const { session } = useAuthentication();
  const { setTitleBarState, titleBarState } = useGlobalContext();
  const [activeSection, setActiveSection] = useState<ActiveSection>('profile');

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

  const ProfileInformation = () => (
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
            <p className="text-muted-foreground">ID de Usuario: {session.id}</p>
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

  const IntegrationsSection = () => (
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

      {/* Patreon Integration Status (if available) */}
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

  const HelpSection = () => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">¿Necesitas Ayuda?</h3>
        <p className="text-muted-foreground text-sm mb-4">
          ¿Tienes problemas con tus integraciones o configuración de cuenta?
        </p>
        <Button variant="outline" size="sm">
          Contactar Soporte
        </Button>
      </CardContent>
    </Card>
  );

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
                  <button
                    onClick={() => setActiveSection('profile')}
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
                  </button>

                  <button
                    onClick={() => setActiveSection('integrations')}
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
                  </button>

                  <button
                    onClick={() => setActiveSection('help')}
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
                  </button>
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
          <div className="space-y-6">
            {activeSection === 'profile' && <ProfileInformation />}
            {activeSection === 'integrations' && <IntegrationsSection />}
            {activeSection === 'help' && <HelpSection />}
          </div>
        </div>
      </div>
    </div>
  );
};