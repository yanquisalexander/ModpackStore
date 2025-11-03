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
      // Use the new backend endpoint for accurate count
      const count = await TicketsService.getUnreadCount(sessionTokens.accessToken);
      setUnreadCount(count);
      
      // We can't reliably determine which specific tickets are unread without more API data
      // For now, just clear the unread set and let WebSocket events repopulate it
      // In production, we would need an endpoint that returns the actual unread ticket IDs
      setUnreadTickets(new Set());
    } catch (error) {
      console.error('Error fetching unread ticket count:', error);
    }
  }, [sessionTokens]);

  // Mark a ticket as read
  const markTicketAsRead = useCallback((ticketId: string) => {
    setUnreadTickets(prev => {
      const newSet = new Set(prev);
      newSet.delete(ticketId);
      return newSet;
    });
    // Decrement count locally instead of fetching from backend
    setUnreadCount(prev => Math.max(0, prev - 1));
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
