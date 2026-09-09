import { useEffect, useRef, lazy, Suspense, memo, Fragment, useState } from "react";
import "./App.css";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useConnection } from "./utils/ConnectionContext";
import { LucideLoader } from "lucide-react";
import { useAuthentication } from "./stores/AuthContext";
import { useConfigDialog } from "./stores/ConfigDialogContext";
import { useTermsAndConditions } from "./hooks/useTermsAndConditions";
import { useOnboarding } from "./hooks/useOnboarding";
import { useNotifications } from "./hooks/useNotifications";
import { AppSidebar } from "./components/AppSidebar";
import { useLayout } from "./providers/LayoutProvider";
import { initAnalytics } from "./lib/analytics";
import { trackEvent } from "@aptabase/web";

// Rutas eager (se cargan siempre - usadas por todos los usuarios)
import { ExploreSection } from "./views/ExploreSection";
import { HomeView } from "./views/HomeView";
import { ServersSection } from "./views/ServersSection";
import { ServerDetailView } from "./views/ServerDetailView";
import { PreLaunchInstance } from "./views/PreLaunchInstance";
import { MyInstancesSection } from "./views/MyInstancesSection";
import { LibrarySection } from "./views/LibrarySection";
import { Login } from "./views/Login";
import { NotFound } from "./views/NotFound";
import { AccountsSection } from "./views/AccountsSection";
import { BannedScreen } from "./components/BannedScreen";
import { OfflineMode } from "./views/OfflineMode";

// Importaciones estáticas para creadores (a petición)
import { CreatorsLayout } from "./components/layouts/CreatorsLayout";
import { CreatorProfileView } from "./views/CreatorProfileView";

// Rutas lazy (se cargan bajo demanda)
const ModpackOverview = lazy(() => import("./views/ModpackOverview").then(m => ({ default: m.ModpackOverview })));
const WhitelistInstancesView = lazy(() => import("./views/WhitelistInstancesView").then(m => ({ default: m.WhitelistInstancesView })));
const TicketsSection = lazy(() => import("./components/TicketsSection").then(m => ({ default: m.TicketsSection })));

// Layouts lazy (solo para roles específicos)
const AdminLayout = lazy(() => import("./components/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));

// Dialogos lazy (solo se cargan al abrirse)
const ConfigurationDialog = lazy(() => import("./components/ConfigurationDialog").then(m => ({ default: m.ConfigurationDialog })));
const TermsAndConditionsDialog = lazy(() => import("./components/TermsAndConditionsDialog").then(m => ({ default: m.TermsAndConditionsDialog })));
const OnboardingFlow = lazy(() => import("./components/onboarding").then(m => ({ default: m.OnboardingFlow })));
const SessionExpiredDialog = lazy(() => import("./components/SessionExpiredDialog").then(m => ({ default: m.SessionExpiredDialog })));

// Dialogos eager (siempre presentes, ligeros)
import { Changelog } from "./components/Changelog";
import { ReminderModal } from "./components/ReminderModal";
import { PlusFeatureDialog } from "./components/PremiumFeatureDialog";
import NoticeTestBuild from "./components/NoticeTestBuild";
import { KonamiCode } from "./components/KonamiCode";
import CommandPalette from "./components/CommandPalette";

// ProfileView - se mantiene eager porque sus sub-componentes se usan en rutas anidadas
import { ProfileView, ProfileInformation, IntegrationsSection, HelpSection } from "./views/ProfileView";
import GlassCircleWrench from "./icons/GlassCircleWrench";

// --- Componentes Helper para Rutas ---
const LoadingScreen = () => (
  <div className="absolute inset-0 flex items-center justify-center min-h-full h-full w-full">
    <LucideLoader className="size-10 -mt-12 animate-spin-clockwise animate-iteration-count-infinite animate-duration-1000 text-white" />
  </div>
);

// Helper para evitar el flash de NotFound dando un "grace period" de 500ms para que se hidraten los roles
const ProtectedRoute = ({ isAllowed, children }: { isAllowed: boolean, children: React.ReactNode }) => {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (!isAllowed) {
      timer = setTimeout(() => setShowFallback(true), 500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAllowed]);

  if (isAllowed) {
    return <>{children}</>;
  }

  // Muestra pantalla de carga temporalmente, luego muestra el NotFound si se agota el tiempo
  return showFallback ? <NotFound /> : <LoadingScreen />;
};

const PreLaunchPage = () => {
  return <PreLaunchInstance />;
};

const ModpackOverviewPage = () => {
  const { modpackId } = useParams<{ modpackId: string }>();
  return <ModpackOverview modpackId={modpackId!} />;
};

const SectionInMaintenance = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center min-h-full h-full text-center">
    <div className="relative flex items-center justify-center w-20 h-20 mb-8">
      <svg width="80" height="80" viewBox="0 0 80 80" className="absolute inset-0 animate-[pulse-ring_2.6s_ease-in-out_infinite]">
        <circle cx="40" cy="40" r="36" fill="none" stroke="#7F77DD" strokeWidth="1.5" strokeDasharray="4 7" />
        <circle cx="40" cy="40" r="29" fill="none" stroke="#AFA9EC" strokeWidth="1" strokeDasharray="2 10" className="animate-spin [animation-duration:10s]" />
      </svg>
      <div className="relative z-10 flex items-center justify-center w-13 h-13 rounded-xl bg-[#EEEDFE] border border-[#AFA9EC]">
        <GlassCircleWrench className="size-6 text-[#534AB7]" />
      </div>
    </div>

    <h2 className="text-lg font-medium text-white">{title}</h2>
    <p className="text-sm text-gray-400 mt-2 max-w-[280px] leading-relaxed">
      Esta sección está en mantenimiento.
    </p>
  </div>
);

// --- Componente de Rutas (memoizado) ---
interface AppRoutesProps {
  isConnected: boolean;
  isAuthenticated: boolean;
  session: any;
}

const AppRoutes = memo(function AppRoutes({ isConnected, isAuthenticated, session }: AppRoutesProps) {
  if (!isConnected) {
    return (
      <Routes>
        <Route path="/" element={<OfflineMode />} />
        <Route path="/my-instances" element={<MyInstancesSection offlineMode={true} />} />
        <Route path="/mc-accounts" element={<AccountsSection />} />
        <Route path="/prelaunch/:instanceId" element={<PreLaunchPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/prelaunch/:instanceId" element={<PreLaunchPage />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/explore" element={<ExploreSection />} />
        <Route path="/whitelist-instances" element={<WhitelistInstancesView />} />
        <Route path="/library" element={<LibrarySection />} />
        <Route path="/my-instances" element={<MyInstancesSection offlineMode={false} />} />
        <Route path="/servers" element={<ServersSection />} />
        <Route path="/server/:instanceId" element={<ServerDetailView />} />
        <Route path="/prelaunch/:instanceId" element={<PreLaunchPage />} />
        <Route path="/modpack/:modpackId" element={<ModpackOverviewPage />} />
        <Route path="/mc-accounts" element={<AccountsSection />} />
        <Route path="/profile" element={<ProfileView />}>
          <Route index element={<ProfileInformation />} />
          <Route path="integrations" element={<IntegrationsSection />} />
          <Route path="tickets" element={<TicketsSection />} />
          <Route path="help" element={<HelpSection />} />
        </Route>

        {/* Creadores: Usa ProtectedRoute para manejar el delay de los permisos */}
        <Route
          path="/creators/*"
          element={
            <ProtectedRoute isAllowed={!!(session?.creatorMemberships && session.creatorMemberships.length > 0)}>
              <CreatorsLayout />
            </ProtectedRoute>
          }
        />

        {/* Admin: Usa ProtectedRoute para manejar el delay de los permisos */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute isAllowed={!!session?.isAdmin?.()}>
              <AdminLayout />
            </ProtectedRoute>
          }
        />

        <Route path="/c/:creatorSlug" element={<CreatorProfileView />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
});

// --- Componente Principal ---
function App() {
  const { loading: authLoading, isAuthenticated, session, showSessionExpired, startDiscordAuth } = useAuthentication();
  const { isConnected, isLoading: connectionLoading, hasInternetAccess } = useConnection();
  const { isConfigOpen, closeConfigDialog } = useConfigDialog();
  const { onboardingStatus, loading: onboardingLoading, isFirstRun, refreshStatus } = useOnboarding();
  const { shouldShowDialog: shouldShowToSDialog, tosContent, acceptTerms, rejectTerms } = useTermsAndConditions();
  const navigate = useNavigate();
  const hasLaunched = useRef(false);
  const { setHasSidebar, hasSidebar } = useLayout();

  const { requestPermission, permissionGranted } = useNotifications();

  useEffect(() => {
    if (!permissionGranted) {
      requestPermission();
    }
  }, [permissionGranted, requestPermission]);

  // Use a ref to track if we've already tried to check connection
  const hasCheckedConnectionRef = useRef(false);

  useEffect(() => {
    const connectionToastId = "connection-status";

    if (!isConnected && !connectionLoading) {
      const message = hasInternetAccess ? "Servidor no disponible" : "Sin conexión a internet";
      const description = hasInternetAccess
        ? "No se ha podido conectar al servidor. Algunas funciones no están disponibles."
        : "No se detectó una conexión a internet activa. Estás en modo sin conexión.";

      toast.warning(message, {
        id: connectionToastId,
        duration: Infinity,
        richColors: true,
        description: description,
      });
    } else {
      toast.dismiss(connectionToastId);
    }
  }, [isConnected, hasInternetAccess, connectionLoading]);

  useEffect(() => {
    if (!hasLaunched.current) {
      initAnalytics();
      trackEvent("app_launch");
      hasLaunched.current = true;
    }

    const handler = (e: Event) => {
      const instanceId = (e as CustomEvent<string>).detail;
      navigate(`/prelaunch/${instanceId}`);
    };
    window.addEventListener("navigate-to-instance", handler);
    return () => window.removeEventListener("navigate-to-instance", handler);
  }, [navigate]);

  const shouldShowLoading = authLoading || onboardingLoading ||
    (connectionLoading && !hasCheckedConnectionRef.current);

  const isShowingLogin = !isAuthenticated && isConnected && !isFirstRun;

  useEffect(() => {
    if (!connectionLoading) {
      hasCheckedConnectionRef.current = true;
    }
  }, [connectionLoading]);

  useEffect(() => {
    const hasSidebar = (isAuthenticated || !isConnected) && !isFirstRun && !session?.isBanned;
    setHasSidebar(hasSidebar);
  }, [isAuthenticated, isConnected, isFirstRun, session?.isBanned, setHasSidebar]);

  const isBanned = isAuthenticated && session?.isBanned;

  if (shouldShowLoading) {
    return <LoadingScreen />;
  }

  if (isBanned) {
    return <BannedScreen />;
  }

  return (
    <>
      {(isAuthenticated || !isConnected) && !isFirstRun && !isBanned && <AppSidebar />}
      <main className={`overflow-y-auto h-full border-t p-0 m-0 ${isShowingLogin ? "border-transparent" : "relative bg-[var(--background)]"} ${hasSidebar ? 'rounded-tl-md border-l' : 'border-l-transparent'}`} style={{ gridArea: 'main' }}>
        <Fragment>
          {isFirstRun ? (
            <Suspense fallback={<LoadingScreen />}>
              <OnboardingFlow onComplete={refreshStatus} />
            </Suspense>
          ) : (
            <AppRoutes
              isConnected={isConnected}
              isAuthenticated={isAuthenticated}
              session={session}
            />
          )}
        </Fragment>

        {/* Componentes globales */}
        <CommandPalette />
        <ReminderModal />
        <PlusFeatureDialog />
        {isConfigOpen && (
          <Suspense fallback={null}>
            <ConfigurationDialog isOpen={isConfigOpen} onClose={closeConfigDialog} />
          </Suspense>
        )}
        {shouldShowToSDialog && (
          <Suspense fallback={null}>
            <TermsAndConditionsDialog
              open={shouldShowToSDialog}
              content={tosContent}
              onAccept={acceptTerms}
              onReject={rejectTerms}
            />
          </Suspense>
        )}
        <Changelog />
        {showSessionExpired && (
          <Suspense fallback={null}>
            <SessionExpiredDialog
              isOpen={showSessionExpired}
              onLogin={startDiscordAuth}
            />
          </Suspense>
        )}
        <KonamiCode />
      </main>
    </>
  );
}

export default App;