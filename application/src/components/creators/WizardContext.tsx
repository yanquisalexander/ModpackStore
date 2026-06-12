import React, { createContext, useContext, useState, useCallback } from "react";
import PublisherModpackVersionWizard from "@/components/publisher/PublisherModpackVersionWizard";

interface WizardState {
  isOpen: boolean;
  modpack: any;
  existingVersions: any[];
  onSuccess: () => void;
}

interface WizardContextType {
  openWizard: (modpack: any, existingVersions: any[], onSuccess: () => void) => void;
  closeWizard: () => void;
}

const WizardContext = createContext<WizardContextType | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WizardState>({
    isOpen: false,
    modpack: null,
    existingVersions: [],
    onSuccess: () => {},
  });

  const openWizard = useCallback(
    (modpack: any, existingVersions: any[], onSuccess: () => void) => {
      setState({ isOpen: true, modpack, existingVersions, onSuccess });
    },
    [],
  );

  const closeWizard = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <WizardContext.Provider value={{ openWizard, closeWizard }}>
      {children}
      <PublisherModpackVersionWizard
        isOpen={state.isOpen}
        onClose={closeWizard}
        onSuccess={state.onSuccess}
        modpack={state.modpack}
        existingVersions={state.existingVersions}
      />
    </WizardContext.Provider>
  );
}

export function useWizard(): WizardContextType {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}
