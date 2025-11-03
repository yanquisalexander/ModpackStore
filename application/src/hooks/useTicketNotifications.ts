import { useState, useEffect, useCallback } from 'react';
import { useRealtimeContext } from '@/providers/RealtimeProvider';
import { useAuthentication } from '@/stores/AuthContext';
import * as TicketsService from '@/services/tickets';

interface TicketNotificationData {
  ticketId: string;
  ticketNumber?: string;
  message?: any;
  status?: string;
}

/**
 * Hook to manage unread ticket notifications
 * Listens to WebSocket events and maintains a count of unread tickets
 */
export const useTicketNotifications = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadTickets, setUnreadTickets] = useState<Set<string>>(new Set());
  const { session, sessionTokens } = useAuthentication();
  const realtime = useRealtimeContext();

  // Fetch initial unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!sessionTokens?.accessToken) return;

    try {
      // Use the new backend endpoint for more accurate count
      const count = await TicketsService.getUnreadCount(sessionTokens.accessToken);
      setUnreadCount(count);
      
      // Optionally fetch ticket list to populate unread set
      const tickets = session?.isStaff?.()
        ? await TicketsService.getAllTickets(sessionTokens.accessToken)
        : await TicketsService.getUserTickets(sessionTokens.accessToken);
      
      // Build unread set based on tickets (simplified - in production would need better tracking)
      const unreadSet = new Set<string>();
      tickets.slice(0, count).forEach(ticket => unreadSet.add(ticket.id));
      setUnreadTickets(unreadSet);
    } catch (error) {
      console.error('Error fetching unread ticket count:', error);
    }
  }, [session, sessionTokens]);

  // Mark a ticket as read
  const markTicketAsRead = useCallback((ticketId: string) => {
    setUnreadTickets(prev => {
      const newSet = new Set(prev);
      newSet.delete(ticketId);
      setUnreadCount(newSet.size);
      return newSet;
    });
  }, []);

  // Listen to new_ticket event (staff only)
  useEffect(() => {
    if (!realtime?.isConnected || !realtime?.on || !session?.isStaff?.()) return;

    const unsubscribe = realtime.on('new_ticket', (payload: TicketNotificationData) => {
      setUnreadTickets(prev => {
        const newSet = new Set(prev);
        newSet.add(payload.ticketId);
        setUnreadCount(newSet.size);
        return newSet;
      });
    });

    return unsubscribe;
  }, [realtime?.isConnected, realtime?.on, session]);

  // Listen to new_message event
  useEffect(() => {
    if (!realtime?.isConnected || !realtime?.on) return;

    const unsubscribe = realtime.on('new_message', (payload: TicketNotificationData) => {
      // For staff: new messages from users
      // For users: new messages from staff
      const isStaffMessage = payload.message?.isStaffMessage;
      const shouldNotify = session?.isStaff?.() ? !isStaffMessage : isStaffMessage;

      if (shouldNotify) {
        setUnreadTickets(prev => {
          const newSet = new Set(prev);
          newSet.add(payload.ticketId);
          setUnreadCount(newSet.size);
          return newSet;
        });
      }
    });

    return unsubscribe;
  }, [realtime?.isConnected, realtime?.on, session]);

  // Listen to ticket_status_updated event
  useEffect(() => {
    if (!realtime?.isConnected || !realtime?.on) return;

    const unsubscribe = realtime.on('ticket_status_updated', (payload: TicketNotificationData) => {
      // When status changes, mark as unread for users
      if (!session?.isStaff?.()) {
        setUnreadTickets(prev => {
          const newSet = new Set(prev);
          newSet.add(payload.ticketId);
          setUnreadCount(newSet.size);
          return newSet;
        });
      }
    });

    return unsubscribe;
  }, [realtime?.isConnected, realtime?.on, session]);

  // Load initial count on mount
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    unreadTickets,
    markTicketAsRead,
    refreshCount: fetchUnreadCount
  };
};
