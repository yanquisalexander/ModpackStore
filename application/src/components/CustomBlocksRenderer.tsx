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

    return (
        <>
            {blocks.map((block, index) => {
                const tagName = getDefaultTagName(block);
                const content = renderContent(block);
                const positionStyle = block.position ? {
                    position: 'absolute' as const,
                    top: block.position.top,
                    left: block.position.left,
                    right: block.position.right,
                    bottom: block.position.bottom,
                    transform: block.position.transform,
                    zIndex: block.position.zIndex,
                } : undefined;

                const combinedClassName = [
                    block.className,
                    block.position ? 'absolute' : ''
                ].filter(Boolean).join(' ');

                let combinedStyle = positionStyle;

                // Parse style string if provided
                if (block.style) {
                    try {
                        const parsedStyle = JSON.parse(block.style);
                        combinedStyle = { ...positionStyle, ...parsedStyle };
                    } catch (e) {
                        // If style is not valid JSON, ignore it
                        console.warn('Invalid style JSON for custom block:', block.style);
                    }
                }

                return React.createElement(
                    tagName,
                    {
                        key: block.id || `custom-block-${index}`,
                        className: combinedClassName,
                        style: combinedStyle,
                        dangerouslySetInnerHTML: { __html: content }
                    }
                );
            })}
        </>
    );
};

export default CustomBlocksRenderer;