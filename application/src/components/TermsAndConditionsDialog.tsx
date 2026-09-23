import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { LucideLoader, LucideFileText, LucideX, LucideShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { exit } from '@tauri-apps/plugin-process';

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
    const timerRef = useRef<number | null>(null);

    const handleScroll = () => {
        const scrollArea = scrollAreaRef.current;
        if (scrollArea) {
            const { scrollTop, scrollHeight, clientHeight } = scrollArea;
            const threshold = 10;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - threshold;

            if (isAtBottom && !hasReachedBottom) {
                setHasReachedBottom(true);
                startTimer();
            }
        }
    };

    const startTimer = () => {
        if (timerRef.current) return;

        let counter = 5;
        setTimeRemaining(counter);

        timerRef.current = window.setInterval(() => {
            counter--;
            setTimeRemaining(counter);

            if (counter <= 0) {
                setCanAccept(true);
                if (timerRef.current) {
                    window.clearInterval(timerRef.current);
                    timerRef.current = null;
                }
            }
        }, 1000);
    };

    useEffect(() => {
        if (open) {
            setHasReachedBottom(false);
            setTimeRemaining(5);
            setCanAccept(false);
            setIsAccepting(false);

            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }, [open]);

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

        setTimeout(async () => {
            try {
                await exit(0);
            } catch (error) {
                console.error('Error closing app:', error);
                onReject();
            }
        }, 3000);
    };

    if (!content) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={() => { }} modal>
            <DialogContent className="fixed inset-0 border-none ring-0 z-[2000] top-[var(--app-top-bar-height)] !left-0 !right-0 !bottom-0 !translate-x-0 !translate-y-0 !w-screen !h-[calc(100%-36px)] !max-w-none !rounded-none m-0 p-0 flex flex-col bg-[#121212] text-white overflow-hidden">
                <DialogHeader className="border-b border-white/10 px-6 py-4 flex-shrink-0">
                    <DialogTitle className="flex items-center gap-3 text-xl font-bold text-white">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-600/20">
                            <LucideShieldCheck className="h-5 w-5 text-purple-400" />
                        </div>
                        Términos y Condiciones
                    </DialogTitle>
                    <p className="text-sm text-neutral-400 mt-2 ml-[52px]">
                        Para continuar utilizando la aplicación, debes leer y aceptar los siguientes términos.
                    </p>
                </DialogHeader>

                <div className="flex-1 flex flex-col min-h-0">
                    <ScrollArea
                        ref={scrollAreaRef}
                        className="flex-1 px-6 overflow-auto"
                        onScrollCapture={handleScroll}
                    >
                        <div className="py-6 prose prose-invert prose-sm max-w-none
                            prose-headings:text-white prose-headings:font-bold
                            prose-p:text-neutral-300 prose-p:leading-relaxed
                            prose-strong:text-white prose-strong:font-semibold
                            prose-li:text-neutral-300
                            prose-code:text-purple-400 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                            prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline">
                            <ReactMarkdown>{content}</ReactMarkdown>
                        </div>

                        <div className="h-20" />
                    </ScrollArea>
                </div>

                <div className="border-t border-white/10 px-6 py-4 flex-shrink-0 bg-[#0c0c0c]">
                    <div className="flex items-center justify-between">
                        <div className="text-sm">
                            {!hasReachedBottom ? (
                                <span className="text-neutral-500 flex items-center gap-2">
                                    <LucideFileText className="h-4 w-4" />
                                    Desplázate hasta el final para continuar
                                </span>
                            ) : !canAccept ? (
                                <span className="text-neutral-400 flex items-center gap-2">
                                    <LucideLoader className="h-4 w-4 animate-spin text-purple-400" />
                                    Podrás aceptar en {timeRemaining} segundos
                                </span>
                            ) : (
                                <span className="text-emerald-400 flex items-center gap-2">
                                    <LucideShieldCheck className="h-4 w-4" />
                                    Ya puedes aceptar los términos y condiciones
                                </span>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={handleReject}
                                className="bg-transparent border-white/10 hover:bg-white/5 text-white hover:text-white"
                            >
                                <LucideX className="h-4 w-4 mr-2" />
                                Rechazar
                            </Button>
                            <Button
                                onClick={handleAccept}
                                disabled={!canAccept || isAccepting}
                                className="min-w-[120px] bg-purple-600 hover:bg-purple-500 text-white border-0 disabled:bg-purple-600/50 disabled:text-white/50"
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
