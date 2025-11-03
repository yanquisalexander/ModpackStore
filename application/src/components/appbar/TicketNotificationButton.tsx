import { LucideMessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthentication } from '@/stores/AuthContext';
import { useTicketNotifications } from '@/hooks/useTicketNotifications';

export const TicketNotificationButton = () => {
  const navigate = useNavigate();
  const { session } = useAuthentication();
  const { unreadCount } = useTicketNotifications();

  // Don't show the button if there are no unread tickets
  if (unreadCount === 0) {
    return null;
  }

  const handleClick = () => {
    // Navigate to tickets page based on user role
    if (session?.isStaff?.()) {
      navigate('/admin/tickets');
    } else {
      navigate('/profile/tickets');
    }
  };

  return (
    <button
      onClick={handleClick}
      title={`${unreadCount} ticket${unreadCount > 1 ? 's' : ''} sin leer`}
      className="cursor-pointer relative flex size-9 aspect-square items-center justify-center hover:bg-[var(--sidebar-accent)] transition-colors"
      aria-label={`${unreadCount} ticket${unreadCount > 1 ? 's' : ''} sin leer`}
    >
      <LucideMessageSquare className="size-4 text-[var(--sidebar-foreground)]" />
      {/* Badge with count */}
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    </button>
  );
};
