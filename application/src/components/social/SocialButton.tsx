import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { SocialPanel } from './SocialPanel';

interface SocialButtonProps {
  token?: string;
  className?: string;
}

export const SocialButton: React.FC<SocialButtonProps> = ({ token, className = '' }) => {
  const [isSocialPanelOpen, setIsSocialPanelOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsSocialPanelOpen(true)}
        className={`p-2 rounded-md hover:bg-accent transition-colors ${className}`}
        title="Open Social Panel"
      >
        <Users className="w-5 h-5" />
      </button>

      <SocialPanel
        isOpen={isSocialPanelOpen}
        onClose={() => setIsSocialPanelOpen(false)}
        token={token}
      />
    </>
  );
};