import React from "react";
import { GlobalContextProvider } from "../stores/GlobalContext";
import { AuthProvider } from "../stores/AuthContext";
import { TasksProvider } from "../stores/TasksContext";
import { InstancesProvider } from "../stores/InstancesContext";
import { ReloadProvider } from "../stores/ReloadContext";
import { ConfigDialogProvider } from "../stores/ConfigDialogContext";
import { ConnectionProvider } from "../utils/ConnectionContext";
import { RealtimeProvider } from "./RealtimeProvider";

// Este componente recibe 'children', que será el resto de tu aplicación.
export const AppProviders = ({ children }: { children: React.ReactNode }) => {
    return (
        <GlobalContextProvider>
            <AuthProvider>
                <ConnectionProvider>
                    <RealtimeProvider>
                        <TasksProvider>
                            <InstancesProvider>
                                <ReloadProvider>
                                    <ConfigDialogProvider>
                                        {children}
                                    </ConfigDialogProvider>
                                </ReloadProvider>
                            </InstancesProvider>
                        </TasksProvider>
                    </RealtimeProvider>
                </ConnectionProvider>
            </AuthProvider>
        </GlobalContextProvider>
    );
};