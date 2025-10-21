import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import snarkdown from 'snarkdown';
import { CustomBlock } from '@/types/PreLaunchAppeareance';
import { MinecraftInstance } from '@/types/TauriCommandReturns';
import { useAuthentication } from '@/stores/AuthContext';

// Configure DOMPurify to allow common HTML tags
DOMPurify.setConfig({
    ALLOWED_TAGS: [
        'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'strong', 'em', 'b', 'i', 'u', 'strike', 's',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'a', 'img', 'video', 'audio', 'iframe',
        'br', 'hr',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'sup', 'sub', 'small', 'big'
    ],
    ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'width', 'height',
        'class', 'id', 'style',
        'controls', 'autoplay', 'muted', 'loop',
        'frameborder', 'allowfullscreen', 'loading', 'lazy'
    ]
});

// Custom hook for dynamic content processing
const useDynamicContent = (content: string, userSession?: any, instance?: MinecraftInstance) => {
    const [processedContent, setProcessedContent] = useState(content);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const processDynamicContent = async () => {
            if (!content) return;

            setLoading(true);
            try {
                let processed = content;

                // Process $fetch(URL, DEFAULT_VALUE) patterns - DEFAULT_VALUE is now optional
                const fetchPattern = /\$fetch\(([^,]+)(?:,\s*([^)]+))?\)/g;
                const fetchMatches = [...content.matchAll(fetchPattern)];

                for (const match of fetchMatches) {
                    const [fullMatch, url, defaultValue] = match;
                    try {
                        const response = await fetch(url.trim().replace(/['"]/g, ''), {
                            method: 'GET',
                            headers: {
                                'Accept': 'text/plain, application/json'
                            }
                        });

                        if (response.ok) {
                            const data = await response.text();
                            // Try to parse as JSON, fallback to text
                            try {
                                const jsonData = JSON.parse(data);
                                // If it's an object with a common property, extract it
                                if (typeof jsonData === 'object' && jsonData !== null) {
                                    if ('count' in jsonData) processed = processed.replace(fullMatch, jsonData.count);
                                    else if ('total' in jsonData) processed = processed.replace(fullMatch, jsonData.total);
                                    else if ('value' in jsonData) processed = processed.replace(fullMatch, jsonData.value);
                                    else if ('data' in jsonData) processed = processed.replace(fullMatch, jsonData.data);
                                    else processed = processed.replace(fullMatch, JSON.stringify(jsonData));
                                } else {
                                    processed = processed.replace(fullMatch, jsonData);
                                }
                            } catch {
                                // Not JSON, use as plain text
                                processed = processed.replace(fullMatch, data);
                            }
                        } else {
                            // Use default value on error, or 'error' if not provided
                            const fallback = defaultValue ? defaultValue.trim().replace(/['"]/g, '') : 'error';
                            processed = processed.replace(fullMatch, fallback);
                        }
                    } catch (error) {
                        console.warn('Failed to fetch dynamic content:', error);
                        // Use default value on error, or 'error' if not provided
                        const fallback = defaultValue ? defaultValue.trim().replace(/['"]/g, '') : 'error';
                        processed = processed.replace(fullMatch, fallback);
                    }
                }

                // Process $date(FORMAT) patterns - FORMAT is now optional
                const datePattern = /\$date\(([^)]+)?\)/g;
                processed = processed.replace(datePattern, (_, format) => {
                    try {
                        const now = new Date();
                        const formatStr = format ? format.trim().replace(/['"]/g, '') : 'locale';

                        switch (formatStr.toLowerCase()) {
                            case 'iso':
                                return now.toISOString();
                            case 'locale':
                                return now.toLocaleDateString();
                            case 'localetime':
                                return now.toLocaleTimeString();
                            case 'localedatetime':
                                return now.toLocaleString();
                            case 'short':
                                return now.toLocaleDateString('es-ES', { dateStyle: 'short' });
                            case 'medium':
                                return now.toLocaleDateString('es-ES', { dateStyle: 'medium' });
                            case 'long':
                                return now.toLocaleDateString('es-ES', { dateStyle: 'long' });
                            default:
                                // Custom format using toLocaleString options
                                return now.toLocaleString('es-ES', { dateStyle: 'medium' });
                        }
                    } catch {
                        return new Date().toLocaleDateString();
                    }
                });

                // Process $time(FORMAT) patterns - FORMAT is now optional
                const timePattern = /\$time\(([^)]+)?\)/g;
                processed = processed.replace(timePattern, (_, format) => {
                    try {
                        const now = new Date();
                        const formatStr = format ? format.trim().replace(/['"]/g, '') : 'locale';

                        switch (formatStr.toLowerCase()) {
                            case 'iso':
                                return now.toISOString();
                            case 'locale':
                                return now.toLocaleTimeString();
                            case '24h':
                                return now.toLocaleTimeString('es-ES', { hour12: false });
                            case '12h':
                                return now.toLocaleTimeString('es-ES', { hour12: true });
                            case 'seconds':
                                return now.getSeconds().toString().padStart(2, '0');
                            case 'minutes':
                                return now.getMinutes().toString().padStart(2, '0');
                            case 'hours':
                                return now.getHours().toString().padStart(2, '0');
                            default:
                                return now.toLocaleTimeString('es-ES');
                        }
                    } catch {
                        return new Date().toLocaleTimeString();
                    }
                });

                // Process $random(MIN, MAX) patterns - MAX is now optional
                const randomPattern = /\$random\((\d+)(?:,\s*(\d+))?\)/g;
                processed = processed.replace(randomPattern, (_, minStr, maxStr) => {
                    try {
                        const min = parseInt(minStr, 10);
                        const max = maxStr ? parseInt(maxStr, 10) : min + 100; // Default range of 100 if max not provided
                        return Math.floor(Math.random() * (max - min + 1) + min).toString();
                    } catch {
                        return '0';
                    }
                });

                // Process $username(DEFAULT_VALUE) patterns - get authenticated username
                const usernamePattern = /\$username\(([^)]+)?\)/g;
                processed = processed.replace(usernamePattern, (_, defaultValue) => {
                    try {
                        if (userSession?.username) {
                            return userSession.username;
                        }
                        // Use default value if provided, or 'Anonymous' if not
                        return defaultValue ? defaultValue.trim().replace(/['"]/g, '') : 'Anonymous';
                    } catch {
                        return defaultValue ? defaultValue.trim().replace(/['"]/g, '') : 'Anonymous';
                    }
                });

                // Process $mcAccountName(DEFAULT_VALUE) patterns - get Minecraft account name
                const mcAccountPattern = /\$mcAccountName\(([^)]+)?\)/g;
                const mcAccountMatches = [...content.matchAll(mcAccountPattern)];

                for (const match of mcAccountMatches) {
                    const [fullMatch, defaultValue] = match;
                    try {
                        // Get Minecraft account name from selected account in instance
                        if (instance?.accountUuid) {
                            // Import invoke dynamically to avoid circular dependencies
                            const { invoke } = await import('@tauri-apps/api/core');
                            const accounts = await invoke<any[]>('get_all_accounts');
                            const selectedAccount = accounts.find((acc: any) => acc.uuid === instance.accountUuid);
                            if (selectedAccount?.username) {
                                processed = processed.replace(fullMatch, selectedAccount.username);
                            } else {
                                // Account not found, use default value
                                const fallback = defaultValue ? defaultValue.trim().replace(/['"]/g, '') : 'Not linked';
                                processed = processed.replace(fullMatch, fallback);
                            }
                        } else {
                            // No account selected, use default value
                            const fallback = defaultValue ? defaultValue.trim().replace(/['"]/g, '') : 'Not linked';
                            processed = processed.replace(fullMatch, fallback);
                        }
                    } catch (error) {
                        console.warn('Failed to get Minecraft account name:', error);
                        // Use default value on error
                        const fallback = defaultValue ? defaultValue.trim().replace(/['"]/g, '') : 'Not linked';
                        processed = processed.replace(fullMatch, fallback);
                    }
                }

                // Process $counter(NAME, START) patterns - START is now optional
                const counterPattern = /\$counter\(([^,]+)(?:,\s*([^)]+))?\)/g;
                const counters: Record<string, number> = {};
                processed = processed.replace(counterPattern, (_, name, start) => {
                    try {
                        const counterName = name.trim().replace(/['"]/g, '');
                        const startValue = start ? parseInt(start.trim(), 10) : 0;
                        if (!(counterName in counters)) {
                            counters[counterName] = startValue;
                        }
                        const currentValue = counters[counterName];
                        counters[counterName] = currentValue + 1;
                        return currentValue.toString();
                    } catch {
                        return '0';
                    }
                });

                // Process $format(NUMBER, FORMAT) patterns - FORMAT is now optional
                const formatPattern = /\$format\(([^,]+)(?:,\s*([^)]+))?\)/g;
                processed = processed.replace(formatPattern, (_, number, format) => {
                    try {
                        const num = parseFloat(number.trim());
                        const formatStr = format ? format.trim().replace(/['"]/g, '') : 'locale';

                        switch (formatStr.toLowerCase()) {
                            case 'currency':
                                return num.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
                            case 'percent':
                                return (num / 100).toLocaleString('es-ES', { style: 'percent' });
                            case 'decimal':
                                return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            case 'integer':
                                return Math.round(num).toLocaleString('es-ES');
                            default:
                                return num.toLocaleString('es-ES');
                        }
                    } catch {
                        return number.trim();
                    }
                });

                // Process $if(CONDITION, TRUE_VALUE, FALSE_VALUE) patterns - TRUE_VALUE and FALSE_VALUE are now optional
                const ifPattern = /\$if\(([^,]+)(?:,\s*([^,]+))?(?:,\s*([^)]+))?\)/g;
                processed = processed.replace(ifPattern, (_, condition, trueValue, falseValue) => {
                    try {
                        // Simple condition evaluation (can be extended)
                        const cond = condition.trim().replace(/['"]/g, '');
                        const isTrue = cond === 'true' || cond === '1' || cond.length > 0;
                        if (isTrue) {
                            return trueValue ? trueValue.trim().replace(/['"]/g, '') : 'true';
                        } else {
                            return falseValue ? falseValue.trim().replace(/['"]/g, '') : 'false';
                        }
                    } catch {
                        return falseValue ? falseValue.trim().replace(/['"]/g, '') : 'false';
                    }
                });

                // Process $len(TEXT) patterns - no changes needed, already simple
                const lenPattern = /\$len\(([^)]+)\)/g;
                processed = processed.replace(lenPattern, (_, text) => {
                    try {
                        return text.trim().replace(/['"]/g, '').length.toString();
                    } catch {
                        return '0';
                    }
                });

                setProcessedContent(processed);
            } catch (error) {
                console.error('Error processing dynamic content:', error);
                setProcessedContent(content);
            } finally {
                setLoading(false);
            }
        };

        processDynamicContent();
    }, [content, userSession, instance]);

    return { processedContent, loading };
};

// Helper functions
const renderContent = (block: CustomBlock, processedContent: string): string => {
    if (!processedContent) return '';

    switch (block.renderType) {
        case 'html':
            return DOMPurify.sanitize(processedContent);
        case 'markdown':
            return DOMPurify.sanitize(snarkdown(processedContent));
        case 'text':
            return DOMPurify.sanitize(processedContent.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        case 'auto':
        default:
            // Auto-detect: if it contains markdown-like syntax, treat as markdown
            const hasMarkdownSyntax = /[*_`~\[\]()#]/.test(processedContent);
            if (hasMarkdownSyntax) {
                return DOMPurify.sanitize(snarkdown(processedContent));
            }
            return DOMPurify.sanitize(processedContent.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    }
};

const getDefaultTagName = (block: CustomBlock): string => {
    if (block.tagName) return block.tagName;

    // Default tag based on content type
    if (block.renderType === 'markdown' || block.content?.includes('\n')) {
        return 'div';
    }
    return 'p';
};

interface CustomBlocksRendererProps {
    blocks?: CustomBlock[];
    instance?: MinecraftInstance;
}

const CustomBlocksRenderer: React.FC<CustomBlocksRendererProps> = ({ blocks, instance }) => {
    const { session } = useAuthentication();

    if (!blocks || blocks.length === 0) return null;

    return (
        <>
            {blocks.map((block, index) => (
                <CustomBlockComponent
                    key={`custom-block-${index}`}
                    block={block}
                    index={index}
                    userSession={session}
                    instance={instance}
                />
            ))}
        </>
    );
};

// Individual CustomBlock component to properly handle hooks
interface CustomBlockComponentProps {
    block: CustomBlock;
    index: number;
    parentKey?: string;
    userSession?: any;
    instance?: MinecraftInstance;
}

const CustomBlockComponent: React.FC<CustomBlockComponentProps> = ({
    block,
    index,
    parentKey,
    userSession,
    instance
}) => {
    const tagName = getDefaultTagName(block);
    const { processedContent, loading } = useDynamicContent(block.content || '', userSession, instance);
    const content = renderContent(block, processedContent);
    const positionStyle = block.position ? {
        position: 'absolute' as const,
        top: block.position.top,
        left: block.position.left,
        right: block.position.right,
        bottom: block.position.bottom,
        transform: block.position.transform,
        zIndex: block.position.zIndex || block.zIndex,
    } : block.zIndex ? { zIndex: block.zIndex } : undefined;

    const combinedClassName = [
        block.className,
        block.position ? 'absolute' : '',
        loading ? 'opacity-75' : ''
    ].filter(Boolean).join(' ');

    let combinedStyle: React.CSSProperties = positionStyle || {};

    // Parse style string if provided
    if (block.style) {
        try {
            const parsedStyle = JSON.parse(block.style);
            combinedStyle = { ...combinedStyle, ...parsedStyle };
        } catch (e) {
            // If style is not valid JSON, ignore it
            console.warn('Invalid style JSON for custom block:', block.style);
        }
    }

    // Handle custom font classes that might not be recognized by Tailwind
    const fontMappings: Record<string, string> = {
        'font-monocraft': 'Monocraft, sans-serif',
        'font-minecraft-ten': 'Minecraft Ten, sans-serif',
        'font-minecraft-five': 'Minecraft Five, sans-serif',
        'font-jost': 'Jost Variable, sans-serif',
        'font-lexend': 'Lexend Variable, sans-serif',
        'font-albert-sans': 'Albert Sans Variable, sans-serif',
    };

    for (const [className, fontFamily] of Object.entries(fontMappings)) {
        if (combinedClassName.includes(className)) {
            combinedStyle = { ...combinedStyle, fontFamily };
            break; // Only apply the first matching font
        }
    }

    const key = parentKey ? `${parentKey}-${index}` : `custom-block-${index}`;

    // Render children if they exist
    const childrenElements = block.children?.map((child, childIndex) =>
        <CustomBlockComponent
            key={`${key}-child-${childIndex}`}
            block={child}
            index={childIndex}
            parentKey={key}
            userSession={userSession}
            instance={instance}
        />
    );

    return React.createElement(
        tagName,
        {
            key,
            className: combinedClassName,
            style: combinedStyle,
            dangerouslySetInnerHTML: content ? { __html: content } : undefined
        },
        childrenElements
    );
};

export default CustomBlocksRenderer;