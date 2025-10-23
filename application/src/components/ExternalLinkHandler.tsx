import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ExternalLink } from 'lucide-react';

interface ExternalLinkHandlerProps {
    children: string;
    className?: string;
}

// Utility function to handle external links
export const handleExternalLink = (url: string, setShowDialog: (show: boolean) => void, setPendingUrl: (url: string | null) => void) => {
    // Check if it's an external link
    if (url.startsWith('http://') || url.startsWith('https://')) {
        setPendingUrl(url);
        setShowDialog(true);
        return false; // Prevent default navigation
    }
    return true; // Allow internal navigation
};

// Utility function to confirm and open external link
export const confirmAndOpenExternalLink = async (url: string | null, setShowDialog: (show: boolean) => void, setPendingUrl: (url: string | null) => void) => {
    if (url) {
        await openUrl(url);
    }
    setShowDialog(false);
    setPendingUrl(null);
};

export const ExternalLinkHandler: React.FC<ExternalLinkHandlerProps> = ({
    children,
    className
}) => {
    const [showDialog, setShowDialog] = useState(false);
    const [pendingUrl, setPendingUrl] = useState<string | null>(null);

    const handleLinkClick = (url: string) => {
        return handleExternalLink(url, setShowDialog, setPendingUrl);
    };

    const handleConfirm = () => {
        confirmAndOpenExternalLink(pendingUrl, setShowDialog, setPendingUrl);
    };

    const handleCancel = () => {
        setShowDialog(false);
        setPendingUrl(null);
    };

    return (
        <>
            <div className={className}>
                <ReactMarkdown
                    components={{
                        a: ({ href, children, ...props }) => (
                            <a
                                href={href}
                                onClick={(e) => {
                                    if (href && !handleLinkClick(href)) {
                                        e.preventDefault();
                                    }
                                }}
                                {...props}
                            >
                                {children}
                            </a>
                        )
                    }}
                >
                    {children}
                </ReactMarkdown>
            </div>

            <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <ExternalLink className="size-5" />
                            Enlace externo
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Estás a punto de abrir un enlace externo. ¿Estás seguro de que quieres continuar?
                            <br />
                            <span className="text-xs text-muted-foreground mt-2 block">
                                URL: {pendingUrl}
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCancel}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm}>
                            Abrir enlace
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

interface HtmlWithExternalLinksProps {
    html: string;
    className?: string;
}

export const HtmlWithExternalLinks: React.FC<HtmlWithExternalLinksProps> = ({
    html,
    className
}) => {
    const [showDialog, setShowDialog] = useState(false);
    const [pendingUrl, setPendingUrl] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleClick = (e: Event) => {
            const target = e.target as HTMLElement;
            const link = target.closest('a') as HTMLAnchorElement;

            if (link && link.href) {
                const url = link.href;
                if (!handleExternalLink(url, setShowDialog, setPendingUrl)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };

        container.addEventListener('click', handleClick, true);
        return () => container.removeEventListener('click', handleClick, true);
    }, []);

    const handleConfirm = () => {
        confirmAndOpenExternalLink(pendingUrl, setShowDialog, setPendingUrl);
    };

    const handleCancel = () => {
        setShowDialog(false);
        setPendingUrl(null);
    };

    return (
        <>
            <div
                ref={containerRef}
                className={className}
                dangerouslySetInnerHTML={{ __html: html }}
            />

            <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <ExternalLink className="size-5" />
                            Enlace externo
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Estás a punto de abrir un enlace externo. ¿Estás seguro de que quieres continuar?
                            <br />
                            <span className="text-xs text-muted-foreground mt-2 block">
                                URL: {pendingUrl}
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCancel}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm}>
                            Abrir enlace
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};