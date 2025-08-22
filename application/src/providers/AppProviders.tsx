import React from "react";
import { GlobalContextProvider } from "../stores/GlobalContext";
import { AuthProvider } from "../stores/AuthContext";
import { TasksProvider } from "../stores/TasksContext";
import { InstancesProvider } from "../stores/InstancesContext";
import { ReloadProvider } from "../stores/ReloadContext";
import { ConfigDialogProvider } from "../stores/ConfigDialogContext";

// Este componente recibe 'children', que será el resto de tu aplicación.
export const AppProviders = ({ children }: { children: React.ReactNode }) => {
    return (
        <GlobalContextProvider>
            <AuthProvider>
                <TasksProvider>
                    <InstancesProvider>
                        <ReloadProvider>
                            <ConfigDialogProvider>
                                {children}
                            </ConfigDialogProvider>
                        </ReloadProvider>
                    </InstancesProvider>
                </TasksProvider>
            </AuthProvider>
        </GlobalContextProvider>
    );
};