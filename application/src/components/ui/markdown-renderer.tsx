import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Custom YouTube embed component
const YouTubeEmbed: React.FC<{ url: string }> = ({ url }) => {
  // Extract video ID from YouTube URL
  const getVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = getVideoId(url);
  
  if (!videoId) {
    return (
      <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-4 my-4">
        <p className="text-red-400 text-sm">❌ URL de YouTube inválida: {url}</p>
      </div>
    );
  }

  return (
    <div className="my-6">
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          className="absolute top-0 left-0 w-full h-full rounded-lg border border-white/20"
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
};

// Custom components for react-markdown
const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-bold text-white mt-8 mb-4 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-semibold text-white mt-6 mb-3 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl font-medium text-white mt-5 mb-2 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-lg font-medium text-white mt-4 mb-2 first:mt-0">
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-base font-medium text-white mt-3 mb-2 first:mt-0">
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-sm font-medium text-white mt-3 mb-2 first:mt-0">
      {children}
    </h6>
  ),
  p: ({ children }) => (
    <p className="text-white/80 mb-4 leading-relaxed">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside text-white/80 mb-4 space-y-1 ml-4">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside text-white/80 mb-4 space-y-1 ml-4">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-white/80">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-400 pl-4 py-2 my-4 bg-blue-500/10 rounded-r-lg">
      <div className="text-white/90 italic">
        {children}
      </div>
    </blockquote>
  ),
  code: ({ inline, children, ...props }) => {
    if (inline) {
      return (
        <code 
          className="bg-black/40 text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code 
        className="block bg-black/60 text-green-300 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-white/10 my-4"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-black/60 text-green-300 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-white/10 my-4">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 underline transition-colors"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <div className="my-6">
      <img 
        src={src} 
        alt={alt} 
        className="w-full max-w-full h-auto rounded-lg border border-white/20 shadow-lg"
      />
      {alt && (
        <p className="text-white/60 text-sm mt-2 text-center italic">
          {alt}
        </p>
      )}
    </div>
  ),
  hr: () => (
    <hr className="border-white/20 my-8" />
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-6">
      <table className="min-w-full border border-white/20 rounded-lg">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="bg-white/10 text-white font-semibold px-4 py-2 border border-white/20 text-left">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="text-white/80 px-4 py-2 border border-white/20">
      {children}
    </td>
  ),
  // Custom component processor
  // This will handle custom syntax like [youtube: URL]
};

// Process custom components in markdown
const processCustomComponents = (content: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const lines = content.split('\n');
  let currentMarkdown = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for YouTube embed syntax: [youtube: URL]
    const youtubeMatch = line.match(/^\[youtube:\s*(.+?)\]$/);
    
    if (youtubeMatch) {
      // Add any accumulated markdown before this custom component
      if (currentMarkdown.trim()) {
        parts.push(
          <ReactMarkdown key={`md-${i}`} components={components}>
            {currentMarkdown.trim()}
          </ReactMarkdown>
        );
        currentMarkdown = '';
      }
      
      // Add the YouTube component
      parts.push(
        <YouTubeEmbed key={`youtube-${i}`} url={youtubeMatch[1].trim()} />
      );
    } else {
      // Accumulate regular markdown
      currentMarkdown += line + '\n';
    }
  }
  
  // Add any remaining markdown
  if (currentMarkdown.trim()) {
    parts.push(
      <ReactMarkdown key="md-final" components={components}>
        {currentMarkdown.trim()}
      </ReactMarkdown>
    );
  }
  
  return parts;
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '' 
}) => {
  if (!content?.trim()) {
    return (
      <p className="text-white/60 italic">
        Este modpack aún no tiene una descripción.
      </p>
    );
  }

  const processedContent = processCustomComponents(content);

  return (
    <div className={`markdown-content ${className}`}>
      {processedContent}
    </div>
  );
};

export default MarkdownRenderer;