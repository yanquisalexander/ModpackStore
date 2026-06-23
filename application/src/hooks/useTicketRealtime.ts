import { useCallback } from 'react';

interface UseTicketRealtimeOptions {
  onNewMessage?: (data: any) => void;
  onTicketStatusUpdated?: (data: any) => void;
  onNewTicket?: (data: any) => void;
  onUserTyping?: (data: any) => void;
}

export const useTicketRealtime = (_options: UseTicketRealtimeOptions = {}) => {
  const sendTyping = useCallback((_ticketId: string) => {}, []);

  return {
    isConnected: false,
    sendTyping
  };
};
