import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useI18n, UseI18nReturn } from '../hooks/useI18n';

const I18nContext = createContext<UseI18nReturn | undefined>(undefined);

interface I18nProviderProps {
    children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
    const { t, language, messages, setLanguage, availableLanguages, isLoading, detectedSystemLanguage, resetToSystemLanguage } = useI18n();

    const value = useMemo(() => ({
        t, language, messages, setLanguage, availableLanguages, isLoading, detectedSystemLanguage, resetToSystemLanguage,
    }), [t, language, messages, setLanguage, availableLanguages, isLoading, detectedSystemLanguage, resetToSystemLanguage]);

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
}

/**
 * Hook to use i18n context
 * Must be used within an I18nProvider
 */
export function useI18nContext(): UseI18nReturn {
    const context = useContext(I18nContext);
    if (context === undefined) {
        throw new Error('useI18nContext must be used within an I18nProvider');
    }
    return context;
}

/**
 * HOC to inject translation function into component props
 */
export function withTranslation<P extends object>(
    Component: React.ComponentType<P & { t: (key: string, params?: Record<string, string>) => string }>
) {
    return function TranslatedComponent(props: P) {
        const { t } = useI18nContext();
        return <Component {...props} t={t} />;
    };
}

/**
 * Translation component for simple text translation
 */
interface TranslatedTextProps {
    id: string;
    params?: Record<string, string>;
    children?: (translated: string) => ReactNode;
}

export function TranslatedText({ id, params, children }: TranslatedTextProps) {
    const { t } = useI18nContext();
    const translated = t(id, params);

    if (children) {
        return <>{children(translated)}</>;
    }

    return <>{translated}</>;
}