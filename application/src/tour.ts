import { useState, useEffect, useRef } from 'react';
import { driver, DriveStep } from "driver.js";

export const useTour = (tourKey: string = 'default', steps: DriveStep[] = []) => {
    const [hasCompletedTour, setHasCompletedTour] = useState(false);
    const driverRef = useRef<any>(null);

    useEffect(() => {
        // Leer del localStorage si el tour ya se completó
        const completed = localStorage.getItem(`tour_${tourKey}`) === 'true';
        setHasCompletedTour(completed);

        // Configurar el driver con los pasos proporcionados
        driverRef.current = driver({
            popoverClass: 'ms-popover',
            steps: steps,
            onDestroyed: () => completeTour()
        });

        return () => {
            if (driverRef.current) {
                driverRef.current.destroy();
            }
        };
    }, [tourKey, steps]);

    const startTour = () => {
        if (!hasCompletedTour && driverRef.current) {
            driverRef.current.drive();
        }
    };

    const completeTour = () => {
        localStorage.setItem(`tour_${tourKey}`, 'true');
        setHasCompletedTour(true);
    };

    const resetTour = () => {
        localStorage.removeItem(`tour_${tourKey}`);
        setHasCompletedTour(false);
    };

    return {
        hasCompletedTour,
        startTour,
        completeTour,
        resetTour,
        driver: driverRef.current
    };
};

// Ejemplo de pasos para un tour básico
export const defaultTourSteps: DriveStep[] = [
    {
        element: '#search-bar',
        popover: {
            title: 'Buscar Modpacks',
            description: 'Usa esta barra para buscar modpacks por nombre o categoría.'
        }
    },
    {
        element: '.navbar-cuentas',
        popover: {
            title: 'Tus Cuentas',
            description: 'Añade y gestiona tus cuentas de juego aquí.'
        }
    },
    {
        element: '.navbar-mis-instancias',
        popover: {
            title: 'Mis Instancias',
            description: 'Gestiona y crea tus instancias de Minecraft aquí.'
        }
    }
];