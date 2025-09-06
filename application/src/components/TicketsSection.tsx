import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LucideTicket, 
  LucidePlus, 
  LucideMessageSquare, 
  LucideClock, 
  LucideCheck, 
  LucideX,
  LucideSend,
  LucideArrowLeft
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTicketRealtime } from '@/hooks/useTicketRealtime';
import * as TicketsService from '@/services/tickets';
import type { Ticket, TicketMessage } from '@/services/tickets';

const statusConfig = {
  open: { label: 'Abierto', variant: 'default' as const, icon: LucideClock },
  in_review: { label: 'En Revisión', variant: 'secondary' as const, icon: LucideMessageSquare },
  closed: { label: 'Cerrado', variant: 'outline' as const, icon: LucideCheck }
};

export const TicketsSection: React.FC = () => {
  const { session, sessionTokens } = useAuthentication();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'ticket' | 'new'>('list');
  const [newTicketForm, setNewTicketForm] = useState({ subject: '', content: '' });
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Real-time updates
  const { sendTyping } = useTicketRealtime({
    onNewMessage: (data) => {
      // Update the selected ticket if we're viewing it
      if (selectedTicket && data.ticketId === selectedTicket.id && data.message) {
        setSelectedTicket(prev => prev ? {
          ...prev,
          messages: [...(prev.messages || []), data.message]
        } : null);
      }
      
      // Update ticket list timestamp
      setTickets(prev => prev.map(ticket => 
        ticket.id === data.ticketId 
          ? { ...ticket, updatedAt: new Date().toISOString() }
          : ticket
      ));
    },
    onTicketStatusUpdated: (data) => {
      if (selectedTicket && data.ticketId === selectedTicket.id) {
        setSelectedTicket(prev => prev ? { ...prev, status: data.status as any } : null);
      }
      
      setTickets(prev => prev.map(ticket => 
        ticket.id === data.ticketId 
          ? { ...ticket, status: data.status as any }
          : ticket
      ));
    }
  });

  const loadTickets = async () => {
    if (!sessionTokens?.accessToken) return;
    
    try {
      const userTickets = await TicketsService.getUserTickets(sessionTokens.accessToken);
      setTickets(userTickets);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los tickets',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTicketDetails = async (ticketId: string) => {
    if (!sessionTokens?.accessToken) return;
    
    try {
      const ticket = await TicketsService.getTicket(ticketId, sessionTokens.accessToken);
      setSelectedTicket(ticket);
      setView('ticket');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el ticket',
        variant: 'destructive'
      });
    }
  };

  const createTicket = async () => {
    if (!sessionTokens?.accessToken || !newTicketForm.subject.trim() || !newTicketForm.content.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos',
        variant: 'destructive'
      });
      return;
    }

    try {
      const ticket = await TicketsService.createTicket(newTicketForm, sessionTokens.accessToken);
      setTickets(prev => [ticket, ...prev]);
      setNewTicketForm({ subject: '', content: '' });
      setView('list');
      toast({
        title: 'Éxito',
        description: 'Ticket creado correctamente'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo crear el ticket',
        variant: 'destructive'
      });
    }
  };

  const sendMessage = async () => {
    if (!sessionTokens?.accessToken || !selectedTicket || !newMessage.trim()) return;

    setSendingMessage(true);
    try {
      const message = await TicketsService.sendMessage(
        selectedTicket.id, 
        { content: newMessage }, 
        sessionTokens.accessToken
      );
      
      setSelectedTicket(prev => prev ? {
        ...prev,
        messages: [...(prev.messages || []), message]
      } : null);
      
      setNewMessage('');
      toast({
        title: 'Mensaje enviado',
        description: 'Tu mensaje ha sido enviado correctamente'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje',
        variant: 'destructive'
      });
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [sessionTokens]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (view === 'new') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <LucidePlus className="h-5 w-5" />
              Crear Nuevo Ticket
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView('list')}>
              <LucideArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Asunto</label>
            <Input
              placeholder="Describe brevemente tu problema..."
              value={newTicketForm.subject}
              onChange={(e) => setNewTicketForm(prev => ({ ...prev, subject: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Descripción</label>
            <Textarea
              placeholder="Describe tu problema en detalle..."
              rows={6}
              value={newTicketForm.content}
              onChange={(e) => setNewTicketForm(prev => ({ ...prev, content: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setView('list')}>
              Cancelar
            </Button>
            <Button onClick={createTicket}>
              Crear Ticket
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (view === 'ticket' && selectedTicket) {
    const StatusIcon = statusConfig[selectedTicket.status].icon;
    
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setView('list')}>
                <LucideArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <LucideTicket className="h-5 w-5" />
                  {selectedTicket.ticketNumber} - {selectedTicket.subject}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={statusConfig[selectedTicket.status].variant}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig[selectedTicket.status].label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Creado {new Date(selectedTicket.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Messages */}
            <ScrollArea className="h-96 w-full rounded-md border p-4">
              <div className="space-y-4">
                {selectedTicket.messages?.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isStaffMessage ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.isStaffMessage
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {message.isStaffMessage ? 'Soporte de Modpack Store' : message.sender.username}
                        </span>
                        <span className="text-xs opacity-70">
                          {new Date(message.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* New Message */}
            {selectedTicket.status !== 'closed' && (
              <div className="flex gap-2">
                <Textarea
                  placeholder="Escribe tu mensaje..."
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    // Send typing indicator
                    if (e.target.value.length > 0) {
                      sendTyping(selectedTicket.id);
                    }
                  }}
                  rows={3}
                  className="flex-1"
                />
                <Button
                  onClick={sendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  size="sm"
                  className="self-end"
                >
                  <LucideSend className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <LucideTicket className="h-5 w-5" />
            Mis Tickets de Soporte
          </CardTitle>
          <Button onClick={() => setView('new')}>
            <LucidePlus className="h-4 w-4 mr-2" />
            Nuevo Ticket
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <div className="text-center py-8">
            <LucideTicket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No tienes tickets aún</h3>
            <p className="text-muted-foreground mb-4">
              ¿Necesitas ayuda? Crea tu primer ticket de soporte.
            </p>
            <Button onClick={() => setView('new')}>
              <LucidePlus className="h-4 w-4 mr-2" />
              Crear Primer Ticket
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const StatusIcon = statusConfig[ticket.status].icon;
              
              return (
                <div
                  key={ticket.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => loadTicketDetails(ticket.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{ticket.ticketNumber}</span>
                        <Badge variant={statusConfig[ticket.status].variant} className="text-xs">
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[ticket.status].label}
                        </Badge>
                      </div>
                      <h4 className="font-medium mb-1">{ticket.subject}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Creado {new Date(ticket.createdAt).toLocaleDateString()}</span>
                        <span>{ticket.messageCount || 0} mensajes</span>
                      </div>
                    </div>
                    <LucideMessageSquare className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};