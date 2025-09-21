import React, { useState, useRef } from 'react';
import { Users } from 'lucide-react';
import { SocialPanel } from './SocialPanel';

interface SocialButtonProps {
  token?: string;
  className?: string;
  titleBarOpaque?: boolean;
}

export const SocialButton: React.FC<SocialButtonProps> = ({ token, className = '', titleBarOpaque = false }) => {
  const [isSocialPanelOpen, setIsSocialPanelOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Make the button visually similar to PatreonButton (square, size-9, centered)
  const baseClasses = 'cursor-pointer flex group size-9 aspect-square items-center justify-center';
  const lightMode = 'hover:bg-white/60 text-neutral-900';
  const darkMode = 'hover:bg-neutral-800 text-white';

  const combinedClass = `${baseClasses} ${titleBarOpaque ? darkMode : lightMode} ${className}`;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsSocialPanelOpen(true)}
        className={combinedClass}
        title="Social"
        aria-label="Open social panel"
        type="button"
      >
        <Users className="size-4 text-white/80 group-hover:text-white" />
      </button>

      <SocialPanel
        isOpen={isSocialPanelOpen}
        onClose={() => setIsSocialPanelOpen(false)}
        token={token}
        anchorRef={buttonRef}
      />
    </>
  );
};