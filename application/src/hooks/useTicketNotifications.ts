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
      // Get tickets based on user role
      const tickets = session?.isStaff?.()
        ? await TicketsService.getAllTickets(sessionTokens.accessToken)
        : await TicketsService.getUserTickets(sessionTokens.accessToken);

      // For staff: count tickets with unread messages from users
      // For users: count tickets with unread messages from staff
      if (session?.isStaff?.()) {
        // Staff sees tickets with new user messages (not read by staff)
        // This would require backend support to track read status per message
        // For now, we'll use a simpler approach: tickets updated recently
        const recentlyUpdated = tickets.filter(ticket => {
          const updatedAt = new Date(ticket.updatedAt).getTime();
          const now = Date.now();
          // Consider tickets updated in last 24 hours as potentially unread
          return now - updatedAt < 24 * 60 * 60 * 1000;
        });
        setUnreadCount(recentlyUpdated.length);
        setUnreadTickets(new Set(recentlyUpdated.map(t => t.id)));
      } else {
        // Users see tickets with new staff responses
        // Similar approach - tickets updated recently
        const recentlyUpdated = tickets.filter(ticket => {
          const updatedAt = new Date(ticket.updatedAt).getTime();
          const now = Date.now();
          return now - updatedAt < 24 * 60 * 60 * 1000;
        });
        setUnreadCount(recentlyUpdated.length);
        setUnreadTickets(new Set(recentlyUpdated.map(t => t.id)));
      }
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
