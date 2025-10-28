import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface I18nMessages {
    [key: string]: any;
}

export interface I18nData {
    language: string;
    messages: I18nMessages;
}

export interface UseI18nReturn {
    t: (key: string, params?: Record<string, string>) => string;
    language: string;
    messages: I18nMessages;
    setLanguage: (language: string) => Promise<void>;
    availableLanguages: string[];
    isLoading: boolean;
    detectedSystemLanguage: string;
    resetToSystemLanguage: () => Promise<void>;
}

/**
 * Hook for internationalization (i18n) support
 * Automatically listens for language changes and provides translation functions
 */
export function useI18n(): UseI18nReturn {
    const [currentData, setCurrentData] = useState<I18nData>({
        language: 'en',
        messages: {}
    });
    const [availableLanguages, setAvailableLanguages] = useState<string[]>(['en']);
    const [isLoading, setIsLoading] = useState(true);
    const [detectedSystemLanguage, setDetectedSystemLanguage] = useState<string>('en');

    // Load initial translations and available languages
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setIsLoading(true);

                // Get available languages
                const languages = await invoke<string[]>('get_available_languages');
                setAvailableLanguages(languages);

                // Get detected system language
                const detectedLang = await invoke<string>('get_detected_system_language');
                setDetectedSystemLanguage(detectedLang);

                // Get current language from config
                const currentLang = await invoke<string>('get_current_language');

                // Get translations for current language
                const translations = await invoke<I18nData>('get_translations', {
                    language: currentLang
                });

                setCurrentData(translations);
            } catch (error) {
                console.error('Failed to load i18n data:', error);
                // Fallback to English
                setCurrentData({
                    language: 'en',
                    messages: {}
                });
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialData();
    }, []);

    // Listen for language change events
    useEffect(() => {
        const unlisten = listen<I18nData>('language-changed', (event) => {
            setCurrentData(event.payload);
        });

        return () => {
            unlisten.then(fn => fn());
        };
    }, []);

    // Translation function
    const t = useCallback((key: string, params?: Record<string, string>): string => {
        const keys = key.split('.');
        let value: any = currentData.messages;

        // Navigate through nested object
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Key not found, return
                return "[Missing Translation for key " + key + "]";
            }
        }

        // If value is a string, apply parameters
        if (typeof value === 'string') {
            let result = value;
            if (params) {
                for (const [param, replacement] of Object.entries(params)) {
                    result = result.replace(new RegExp(`{{${param}}}`, 'g'), replacement);
                }
            }
            return result;
        }

        // If value is not a string, return the key
        return key;
    }, [currentData.messages]);

    // Set language function
    const setLanguage = useCallback(async (language: string): Promise<void> => {
        try {
            await invoke('set_language', { language });
            // The language-changed event will update the state
        } catch (error) {
            console.error('Failed to set language:', error);
            throw error;
        }
    }, []);

    // Reset to system language function
    const resetToSystemLanguage = useCallback(async (): Promise<void> => {
        try {
            await invoke('reset_to_system_language');
            // The language-changed event will update the state
        } catch (error) {
            console.error('Failed to reset to system language:', error);
            throw error;
        }
    }, []);

    return {
        t,
        language: currentData.language,
        messages: currentData.messages,
        setLanguage,
        availableLanguages,
        isLoading,
        detectedSystemLanguage,
        resetToSystemLanguage
    };
}

/**
 * Hook for getting a single translated message
 * Useful when you only need one translation
 */
export function useTranslation(key: string, params?: Record<string, string>): string {
    const { t } = useI18n();
    return t(key, params);
}

/**
 * Hook for getting the current language
 */
export function useCurrentLanguage(): string {
    const { language } = useI18n();
    return language;
}

/**
 * Hook for language switching functionality
 */
export function useLanguageSwitcher() {
    const { language, setLanguage, availableLanguages, detectedSystemLanguage, resetToSystemLanguage } = useI18n();

    return {
        currentLanguage: language,
        setLanguage,
        availableLanguages,
        detectedSystemLanguage,
        resetToSystemLanguage
    };
}