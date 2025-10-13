import React from "react";
import { GlobalContextProvider } from "../stores/GlobalContext";
import { AuthProvider } from "../stores/AuthContext";
import { TasksProvider } from "../stores/TasksContext";
import { InstancesProvider } from "../stores/InstancesContext";
import { ReloadProvider } from "../stores/ReloadContext";
import { ConfigDialogProvider } from "../stores/ConfigDialogContext";
import { ConnectionProvider } from "../utils/ConnectionContext";
import { RealtimeProvider } from "./RealtimeProvider";
import { LayoutProvider } from "./LayoutProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "./I18nProvider";
import { ThemeProvider } from "../stores/ThemeContext";

// Este componente recibe 'children', que será el resto de tu aplicación.
export const AppProviders = ({ children }: { children: React.ReactNode }) => {
    return (
        <I18nProvider>
            <GlobalContextProvider>
                <AuthProvider>
                    <ThemeProvider>
                        <ConnectionProvider>
                            <RealtimeProvider>
                                <TasksProvider>
                                    <InstancesProvider>
                                        <ReloadProvider>
                                            <ConfigDialogProvider>

                                                <LayoutProvider>
                                                    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                                                        {children}
                                                    </TooltipProvider>
                                                </LayoutProvider>
                                            </ConfigDialogProvider>
                                        </ReloadProvider>
                                    </InstancesProvider>
                                </TasksProvider>
                            </RealtimeProvider>
                        </ConnectionProvider>
                    </ThemeProvider>
                </AuthProvider>
            </GlobalContextProvider>
        </I18nProvider>
    );
};