// components/ErrorScreen.tsx
import React from "react";

interface ErrorScreenProps {
    error: string;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ error }) => {
    return (
        <div className="flex min-h-screen bg-[#202020] text-gray-100 items-center justify-center">
            <div className="p-8 rounded-lg bg-red-900/30 border border-red-500/50 text-center">
                <h2 className="text-xl font-bold text-red-400">Ha ocurrido un error</h2>
                <p className="mt-2 text-gray-300">{error}</p>
            </div>
        </div>
    );
};