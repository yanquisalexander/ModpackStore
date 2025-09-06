import { useEffect, useCallback } from 'react';
import { useRealtimeContext } from '@/providers/RealtimeProvider';
import { useAuthentication } from '@/stores/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface TicketRealtimeEvent {
  ticketId: string;
  message?: any;
  status?: string;
  ticketNumber?: string;
}

interface UseTicketRealtimeOptions {
  onNewMessage?: (data: TicketRealtimeEvent) => void;
  onTicketStatusUpdated?: (data: TicketRealtimeEvent) => void;
  onNewTicket?: (data: TicketRealtimeEvent) => void;
  onUserTyping?: (data: TicketRealtimeEvent & { userId: string; username: string }) => void;
}

export const useTicketRealtime = (options: UseTicketRealtimeOptions = {}) => {
  const { isConnected, on, send } = useRealtimeContext() || {};
  const { session } = useAuthentication();
  const { toast } = useToast();

  const { onNewMessage, onTicketStatusUpdated, onNewTicket, onUserTyping } = options;

  // Handle new messages
  useEffect(() => {
    if (!isConnected || !on) return;

    const unsubscribe = on('new_message', (payload: TicketRealtimeEvent) => {
      // Show notification if message is for a different ticket than currently viewing
      if (payload.message && !payload.message.isStaffMessage && session?.isStaff?.()) {
        toast({
          title: 'Nuevo mensaje',
          description: `Hay un nuevo mensaje en el ticket ${payload.ticketNumber || payload.ticketId}`,
        });
      } else if (payload.message && payload.message.isStaffMessage && !session?.isStaff?.()) {
        toast({
          title: 'Respuesta del soporte',
          description: 'Has recibido una nueva respuesta en tu ticket',
        });
      }
      
      onNewMessage?.(payload);
    });

    return unsubscribe;
  }, [isConnected, on, onNewMessage, session, toast]);

  // Handle ticket status updates
  useEffect(() => {
    if (!isConnected || !on) return;

    const unsubscribe = on('ticket_status_updated', (payload: TicketRealtimeEvent) => {
      if (!session?.isStaff?.()) {
        toast({
          title: 'Estado del ticket actualizado',
          description: `Tu ticket ${payload.ticketNumber} ha sido ${payload.status === 'closed' ? 'cerrado' : 'actualizado'}`,
        });
      }
      
      onTicketStatusUpdated?.(payload);
    });

    return unsubscribe;
  }, [isConnected, on, onTicketStatusUpdated, session, toast]);

  // Handle new tickets (for staff)
  useEffect(() => {
    if (!isConnected || !on || !session?.isStaff?.()) return;

    const unsubscribe = on('new_ticket', (payload: TicketRealtimeEvent) => {
      toast({
        title: 'Nuevo ticket de soporte',
        description: `Se ha creado un nuevo ticket: ${payload.ticketNumber}`,
      });
      
      onNewTicket?.(payload);
    });

    return unsubscribe;
  }, [isConnected, on, onNewTicket, session, toast]);

  // Handle typing indicators
  useEffect(() => {
    if (!isConnected || !on) return;

    const unsubscribe = on('user_typing', (payload: TicketRealtimeEvent & { userId: string; username: string }) => {
      onUserTyping?.(payload);
    });

    return unsubscribe;
  }, [isConnected, on, onUserTyping]);

  // Send typing indicator
  const sendTyping = useCallback((ticketId: string) => {
    if (send && isConnected) {
      send('user_typing', { ticketId });
    }
  }, [send, isConnected]);

  return {
    isConnected: !!isConnected,
    sendTyping
  };
};