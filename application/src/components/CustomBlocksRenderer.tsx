import React from 'react';
import DOMPurify from 'dompurify';
import snarkdown from 'snarkdown';
import { CustomBlock } from '@/types/PreLaunchAppeareance';

interface CustomBlocksRendererProps {
    blocks?: CustomBlock[];
}

const CustomBlocksRenderer: React.FC<CustomBlocksRendererProps> = ({ blocks }) => {
    if (!blocks || blocks.length === 0) return null;

    const renderContent = (block: CustomBlock): string => {
        if (!block.content) return '';

        switch (block.renderType) {
            case 'html':
                return DOMPurify.sanitize(block.content);
            case 'markdown':
                return DOMPurify.sanitize(snarkdown(block.content));
            case 'text':
                return DOMPurify.sanitize(block.content.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
            case 'auto':
            default:
                // Auto-detect: if it contains markdown-like syntax, treat as markdown
                const hasMarkdownSyntax = /[*_`~\[\]()#]/.test(block.content);
                if (hasMarkdownSyntax) {
                    return DOMPurify.sanitize(snarkdown(block.content));
                }
                return DOMPurify.sanitize(block.content.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
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

    const renderBlock = (block: CustomBlock, index: number, parentKey?: string): React.ReactElement => {
        const tagName = getDefaultTagName(block);
        const content = renderContent(block);
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
            block.position ? 'absolute' : ''
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
            renderBlock(child, childIndex, key)
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

    return (
        <>
            {blocks.map((block, index) => renderBlock(block, index))}
        </>
    );
};

export default CustomBlocksRenderer;