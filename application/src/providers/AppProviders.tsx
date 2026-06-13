import React from "react";
import { GlobalContextProvider } from "../stores/GlobalContext";
import { AuthProvider } from "../stores/AuthContext";
import { TasksProvider } from "../stores/TasksContext";
import { InstancesProvider } from "../stores/InstancesContext";
import { ReloadProvider } from "../stores/ReloadContext";
import { ConfigDialogProvider } from "../stores/ConfigDialogContext";
import { SearchBarProvider } from "../stores/SearchBarContext";
import { ConnectionProvider } from "../utils/ConnectionContext";
import { RealtimeProvider } from "./RealtimeProvider";
import { LayoutProvider } from "./LayoutProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "./I18nProvider";
import { ThemeProvider } from "../stores/ThemeContext";

// Providers que NO dependen de AuthContext — memoizados para aislarlos de re-renders de AuthProvider
const IndependentProviders = React.memo(({ children }: { children: React.ReactNode }) => (
    <TasksProvider>
        <InstancesProvider>
            <ReloadProvider>
                <ConfigDialogProvider>
                    <LayoutProvider>
                        <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                            <SearchBarProvider>
                                {children}
                            </SearchBarProvider>
                        </TooltipProvider>
                    </LayoutProvider>
                </ConfigDialogProvider>
            </ReloadProvider>
        </InstancesProvider>
    </TasksProvider>
));

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
    return (
        <I18nProvider>
            <GlobalContextProvider>
                <ConnectionProvider>
                    <AuthProvider>
                        <ThemeProvider>
                            <RealtimeProvider>
                                <IndependentProviders>
                                    {children}
                                </IndependentProviders>
                            </RealtimeProvider>
                        </ThemeProvider>
                    </AuthProvider>
                </ConnectionProvider>
            </GlobalContextProvider>
        </I18nProvider>
    );
};