/**
 * Utility function to request a premium feature
 * Dispatches a custom event that will be caught by the PremiumFeatureDialog component
 * 
 * @param featureTitle - The title of the premium feature
 * @param featureDescription - A description of what the feature does
 * 
 * @example
 * requestPremiumFeature(
 *   'Gestor de Mods',
 *   'Administra y organiza tus mods de forma avanzada con nuestra herramienta de gestión.'
 * );
 */
export const requestPremiumFeature = (featureTitle: string, featureDescription: string) => {
    const event = new CustomEvent('request-plus-feature', {
        detail: {
            featureTitle,
            featureDescription
        }
    });
    window.dispatchEvent(event);
};
