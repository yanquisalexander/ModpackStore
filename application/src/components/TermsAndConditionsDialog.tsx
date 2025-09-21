import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { LucideLoader, LucideFileText, LucideX } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { exit } from '@tauri-apps/plugin-process';
import { invoke } from '@tauri-apps/api/core';

interface TermsAndConditionsDialogProps {
    open: boolean;
    content: string;
    onAccept: () => void;
    onReject: () => void;
}

export const TermsAndConditionsDialog: React.FC<TermsAndConditionsDialogProps> = ({
    open,
    content,
    onAccept,
    onReject
}) => {
    const [hasReachedBottom, setHasReachedBottom] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(5);
    const [canAccept, setCanAccept] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Check if user has scrolled to bottom
    const handleScroll = () => {
        const scrollArea = scrollAreaRef.current;
        if (scrollArea) {
            const { scrollTop, scrollHeight, clientHeight } = scrollArea;
            const threshold = 10; // Allow 10px threshold
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - threshold;

            if (isAtBottom && !hasReachedBottom) {
                setHasReachedBottom(true);
                startTimer();
            }
        }
    };

    // Start the 5-second timer when user reaches bottom
    const startTimer = () => {
        if (timerRef.current) return; // Timer already running

        let counter = 5;
        setTimeRemaining(counter);

        timerRef.current = setInterval(() => {
            counter--;
            setTimeRemaining(counter);

            if (counter <= 0) {
                setCanAccept(true);
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
            }
        }, 1000);
    };

    // Reset state when dialog opens/closes
    useEffect(() => {
        if (open) {
            setHasReachedBottom(false);
            setTimeRemaining(5);
            setCanAccept(false);
            setIsAccepting(false);

            // Clear any existing timer
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }, [open]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);

    const handleAccept = async () => {
        if (!canAccept || isAccepting) return;

        setIsAccepting(true);
        try {
            await onAccept();
        } catch (error) {
            setIsAccepting(false);
            console.error('Error accepting ToS:', error);
        }
    };

    const handleReject = async () => {
        toast.error('Se cerrará la aplicación ya que no se aceptaron los términos y condiciones', {
            duration: 3000,
        });

        // Wait a bit to show the toast, then close the app
        setTimeout(async () => {
            try {
                await exit(0);
            } catch (error) {
                console.error('Error closing app:', error);
                // Fallback: call onReject callback
                onReject();
            }
        }, 3000);
    };

    if (!content) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={() => { }} modal>
            <DialogContent
                className="fixed inset-0 border-none ring-0 z-50 top-9 !left-0 !right-0 !bottom-0 !translate-x-0 !translate-y-0 !w-screen !h-[calc(100%-36px)] !max-w-none !rounded-none m-0 p-0 flex flex-col bg-background"
            >
                {/* Header */}
                <DialogHeader className="border-b px-6 py-4 flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <LucideFileText className="h-6 w-6" />
                        Términos y Condiciones
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Por favor, lee y acepta los términos y condiciones para continuar utilizando la aplicación.
                    </p>
                </DialogHeader>

                {/* Content */}
                <div className="flex-1 flex flex-col min-h-0">
                    <ScrollArea
                        ref={scrollAreaRef}
                        className="flex-1 px-6 overflow-auto"
                        onScrollCapture={handleScroll}
                    >
                        <div className="py-6 prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown
                                components={{
                                    // Customize markdown components if needed
                                    h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-xl font-semibold mb-3 mt-6">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-lg font-medium mb-2 mt-4">{children}</h3>,
                                    p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
                                    ul: ({ children }) => <ul className="mb-4 list-disc list-inside space-y-1">{children}</ul>,
                                    ol: ({ children }) => <ol className="mb-4 list-decimal list-inside space-y-1">{children}</ol>,
                                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                    em: ({ children }) => <em className="italic">{children}</em>,
                                    code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-sm">{children}</code>,
                                }}
                            >
                                {content}
                            </ReactMarkdown>
                        </div>

                        {/* Spacer to ensure user can scroll past the content */}
                        <div className="h-20" />
                    </ScrollArea>
                </div>

                {/* Footer */}
                <div className="border-t px-6 py-4 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                            {!hasReachedBottom ? (
                                <span>Desplázate hasta el final para continuar</span>
                            ) : !canAccept ? (
                                <span>Podrás aceptar en {timeRemaining} segundos</span>
                            ) : (
                                <span>Ya puedes aceptar los términos y condiciones</span>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={handleReject}
                                className="hover:bg-destructive hover:text-destructive-foreground"
                            >
                                <LucideX className="h-4 w-4 mr-2" />
                                Rechazar
                            </Button>
                            <Button
                                onClick={handleAccept}
                                disabled={!canAccept || isAccepting}
                                className="min-w-[120px]"
                            >
                                {isAccepting ? (
                                    <>
                                        <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                                        Aceptando...
                                    </>
                                ) : (
                                    'Aceptar'
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};