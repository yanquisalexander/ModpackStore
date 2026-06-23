import { useState, useEffect, useCallback } from 'react';
import { useAuthentication } from '@/stores/AuthContext';
import * as TicketsService from '@/services/tickets';

/**
 * Hook to manage unread ticket notifications via polling
 */
export const useTicketNotifications = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const { sessionTokens } = useAuthentication();

  const fetchUnreadCount = useCallback(async () => {
    if (!sessionTokens?.accessToken) return;

    try {
      const count = await TicketsService.getUnreadCount(sessionTokens.accessToken);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread ticket count:', error);
    }
  }, [sessionTokens]);

  const markTicketAsRead = useCallback((ticketId: string) => {
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    unreadTickets: new Set<string>(),
    markTicketAsRead,
    refreshCount: fetchUnreadCount
  };
};
