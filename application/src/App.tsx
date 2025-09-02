import { useEffect, useRef } from "react";
import "./App.css";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { HomeMainHeader } from "./components/home/MainHeader";
import { toast } from "sonner";
import { ExploreSection } from "./views/ExploreSection";
import { PreLaunchInstance } from "./views/PreLaunchInstance";
import { useConnection } from "./utils/ConnectionContext";
import { LucideLoader } from "lucide-react";
import { MyInstancesSection } from "./views/MyInstancesSection";
import { useAuthentication } from "./stores/AuthContext";
import { Login } from "./views/Login";
import { NotFound } from "./views/NotFound";
import { KonamiCode } from "./components/KonamiCode";
import { AccountsSection } from "./views/AccountsSection";
import { initAnalytics } from "./lib/analytics";
import { trackEvent } from "@aptabase/web";
import { ModpackOverview } from "./views/ModpackOverview";
import { ProfileView } from "./views/ProfileView";
import { preloadSounds } from "./utils/sounds";
import { OfflineMode } from "./views/OfflineMode";
import NoticeTestBuild from "./components/NoticeTestBuild";
import CommandPalette from "./components/CommandPalette";
import { CreatorsLayout } from "./components/layouts/CreatorsLayout";
import { AdminLayout } from "./components/admin/AdminLayout";
import { ConfigurationDialog } from "./components/ConfigurationDialog";
import { useConfigDialog } from "./stores/ConfigDialogContext";

// --- Componentes Helper para Rutas (Más limpios que los wrappers) ---
const LoadingScreen = () => (
  <div className="absolute inset-0 flex items-center justify-center min-h-dvh h-full w-full">
    <LucideLoader className="size-10 -mt-12 animate-spin-clockwise animate-iteration-count-infinite animate-duration-1000 text-white" />
  </div>
);

// CAMBIO 3: Usar hooks directamente en el componente de la ruta
const PreLaunchPage = () => {
  return <PreLaunchInstance />;
};

const ModpackOverviewPage = () => {
  const { modpackId } = useParams<{ modpackId: string }>();
  return <ModpackOverview modpackId={modpackId!} />;
};

// --- Componente Principal ---
function App() {
  const { loading: authLoading, isAuthenticated, session } = useAuthentication();
  const { isConnected, isLoading: connectionLoading, hasInternetAccess } = useConnection();
  const { isConfigOpen, closeConfigDialog } = useConfigDialog();
  const navigate = useNavigate();
  const hasLaunched = useRef(false);

  // CAMBIO 2: Lógica de toasts simplificada y reactiva
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

  // Efecto de inicialización (sin cambios, ya estaba bien)
  useEffect(() => {
    if (!hasLaunched.current) {
      initAnalytics();
      preloadSounds();
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

  if (authLoading || connectionLoading) {
    return <LoadingScreen />;
  }

  // CAMBIO 1: Lógica de renderizado unificada
  const renderRoutes = () => {
    // 1. Modo Sin Conexión
    if (!isConnected) {
      return (
        <Routes>
          <Route path="/" element={<OfflineMode />} />
          <Route path="/mc-accounts" element={<AccountsSection />} />
          <Route path="/prelaunch/:instanceId" element={<PreLaunchPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      );
    }

    // 2. Usuario no autenticado
    if (!isAuthenticated) {
      return (
        <Routes>
          <Route path="/prelaunch/:instanceId" element={<PreLaunchPage />} />
          <Route path="*" element={<Login />} />
        </Routes>
      );
    }

    // 3. Usuario autenticado y conectado
    return (
      <Routes>
        <Route path="/" element={<ExploreSection />} />
        <Route path="/my-instances" element={<MyInstancesSection offlineMode={false} />} />
        <Route path="/prelaunch/:instanceId" element={<PreLaunchPage />} />
        <Route path="/modpack/:modpackId" element={<ModpackOverviewPage />} />
        <Route path="/mc-accounts" element={<AccountsSection />} />
        <Route path="/profile" element={<ProfileView />} />

        {session?.publisherMemberships && session.publisherMemberships.length > 0 && (
          <Route path="/creators/*" element={<CreatorsLayout />} />
        )}

        {session?.isAdmin?.() && (
          <Route path="/admin/*" element={<AdminLayout />} />
        )}

        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  };

  return (
    <main className="overflow-y-auto h-full">
      {/* El header solo se muestra si el usuario está autenticado y conectado */}
      {isAuthenticated && isConnected && <HomeMainHeader />}

      <div className="">
        {renderRoutes()}
      </div>

      {/* Componentes globales que siempre están presentes */}
      <NoticeTestBuild />
      <CommandPalette />
      <ConfigurationDialog isOpen={isConfigOpen} onClose={closeConfigDialog} />
      <KonamiCode />
    </main>
  );
}

export default App;