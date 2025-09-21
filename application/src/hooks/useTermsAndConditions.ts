import { useState, useEffect, useCallback } from 'react';
import { ToSService, type ToSSettings } from '@/services/termsAndConditions';
import { useAuthentication } from '@/stores/AuthContext';
import { toast } from 'sonner';

interface UseTermsAndConditionsReturn {
    shouldShowDialog: boolean;
    tosContent: string;
    isLoading: boolean;
    error: string | null;
    isAccepting: boolean;
    acceptTerms: () => Promise<void>;
    rejectTerms: () => void;
}

export const useTermsAndConditions = (): UseTermsAndConditionsReturn => {
    const { session, sessionTokens, isAuthenticated } = useAuthentication();
    const [tosSettings, setTosSettings] = useState<ToSSettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAccepting, setIsAccepting] = useState(false);

    // Load ToS settings on mount
    useEffect(() => {
        const loadToSSettings = async () => {
            if (!isAuthenticated) return;
            
            setIsLoading(true);
            setError(null);
            
            try {
                const settings = await ToSService.getPublicSettings();
                setTosSettings(settings);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to load Terms and Conditions';
                setError(errorMessage);
                console.error('Failed to load ToS settings:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadToSSettings();
    }, [isAuthenticated]);

    // Determine if the dialog should be shown
    const shouldShowDialog = !!(
        isAuthenticated &&
        session &&
        tosSettings?.enabled &&
        tosSettings?.content &&
        !session.tosAcceptedAt &&
        !isLoading &&
        !error
    );

    // Accept terms function
    const acceptTerms = useCallback(async () => {
        if (!sessionTokens?.accessToken || isAccepting) return;

        setIsAccepting(true);
        setError(null);

        try {
            await ToSService.acceptTerms(sessionTokens.accessToken);
            
            // Update the session context by triggering a re-fetch
            // This is a bit hacky but works with the current auth context structure
            // In a production app, you might want to add a method to refresh the session
            window.location.reload();
            
            toast.success('Términos y condiciones aceptados exitosamente');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to accept terms';
            setError(errorMessage);
            toast.error('Error al aceptar los términos y condiciones');
            console.error('Failed to accept ToS:', err);
        } finally {
            setIsAccepting(false);
        }
    }, [sessionTokens?.accessToken, isAccepting]);

    // Reject terms function (placeholder - actual implementation is in the dialog component)
    const rejectTerms = useCallback(() => {
        // This is handled in the dialog component with app closure
        console.log('Terms rejected - app should close');
    }, []);

    return {
        shouldShowDialog,
        tosContent: tosSettings?.content || '',
        isLoading,
        error,
        isAccepting,
        acceptTerms,
        rejectTerms,
    };
};