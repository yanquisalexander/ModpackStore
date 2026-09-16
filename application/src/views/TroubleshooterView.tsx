import React, { Suspense } from "react";
import { LucideLoader } from "lucide-react";
import { TroubleshooterLayout } from "@/components/troubleshooter/TroubleshooterLayout";

const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-full h-full">
        <LucideLoader className="size-8 animate-spin text-primary" />
    </div>
);

export const TroubleshooterView: React.FC = () => {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <TroubleshooterLayout />
        </Suspense>
    );
};
