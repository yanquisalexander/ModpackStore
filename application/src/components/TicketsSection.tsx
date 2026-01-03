import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  LucideTicket, LucidePlus, LucideMessageSquare, LucideClock,
  LucideCheckCircle2, LucideXCircle, LucideSend, LucideArrowLeft,
  LucideLoader2, LucideUser, LucideShieldAlert
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTicketRealtime } from '@/hooks/useTicketRealtime';
import * as TicketsService from '@/services/tickets';
import type { Ticket } from '@/services/tickets';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

// --- CONFIGURACIÓN VISUAL ---
const statusStyles = {
  open: { label: 'Abierto', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: LucideClock },
  in_review: { label: 'En Revisión', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: LucideMessageSquare },
  closed: { label: 'Cerrado', color: 'text-neutral-400', bg: 'bg-neutral-500/10', border: 'border-neutral-500/20', icon: LucideCheckCircle2 }
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
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- LÓGICA (Mantenida) ---
  const { sendTyping } = useTicketRealtime({
    onNewMessage: (data) => {
      if (selectedTicket && data.ticketId === selectedTicket.id && data.message) {
        setSelectedTicket(prev => {
          if (!prev) return null;
          const existing = prev.messages || [];
          const merged = mergeAndSortMessages(existing, [data.message]);
          return { ...prev, messages: merged };
        });
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
      setTickets(prev => prev.map(ticket =>
        ticket.id === data.ticketId ? { ...ticket, updatedAt: new Date().toISOString() } : ticket
      ));
    },
    onTicketStatusUpdated: (data) => {
      if (selectedTicket && data.ticketId === selectedTicket.id) {
        setSelectedTicket(prev => prev ? { ...prev, status: data.status as any } : null);
      }
      setTickets(prev => prev.map(ticket =>
        ticket.id === data.ticketId ? { ...ticket, status: data.status as any } : ticket
      ));
    }
  });

  function mergeAndSortMessages(existing: Ticket['messages'] = [], incoming: Ticket['messages'] = []) {
    const map = new Map<string, any>();
    existing.forEach(m => map.set(m.id, m));
    incoming.forEach(m => map.set(m.id, m));
    const arr = Array.from(map.values());
    arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return arr;
  }

  const loadTickets = async () => {
    if (!sessionTokens?.accessToken) return;
    try {
      const userTickets = await TicketsService.getUserTickets(sessionTokens.accessToken);
      setTickets(userTickets);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los tickets', variant: 'destructive' });
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
      if (!session?.isStaff?.()) {
        await TicketsService.markMessagesAsReadByUser(ticketId, sessionTokens.accessToken);
      }
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo cargar el ticket', variant: 'destructive' });
    }
  };

  const createTicket = async () => {
    if (!sessionTokens?.accessToken || !newTicketForm.subject.trim() || !newTicketForm.content.trim()) {
      toast({ title: 'Error', description: 'Por favor completa todos los campos', variant: 'destructive' });
      return;
    }
    if (isCreatingTicket) return;

    setIsCreatingTicket(true);
    try {
      const ticket = await TicketsService.createTicket(newTicketForm, sessionTokens.accessToken);
      setTickets(prev => [ticket, ...prev]);
      setNewTicketForm({ subject: '', content: '' });
      setView('list');
      toast({ title: 'Éxito', description: 'Ticket creado correctamente' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo crear el ticket', variant: 'destructive' });
    } finally {
      setIsCreatingTicket(false);
    }
  };

  const sendMessage = async () => {
    if (!sessionTokens?.accessToken || !selectedTicket || !newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const message = await TicketsService.sendMessage(selectedTicket.id, { content: newMessage }, sessionTokens.accessToken);
      setSelectedTicket(prev => {
        if (!prev) return null;
        const merged = mergeAndSortMessages(prev.messages || [], [message]);
        return { ...prev, messages: merged };
      });
      setNewMessage('');
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo enviar el mensaje', variant: 'destructive' });
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => { loadTickets(); }, [sessionTokens]);

  // --- RENDER ---

  if (loading) {
    return (
      <div className="h-[700px] flex flex-col items-center justify-center bg-[#0a0a0a] rounded-xl border border-white/5">
        <LucideLoader2 className="h-8 w-8 animate-spin text-purple-500" />
        <p className="mt-4 text-neutral-500 text-sm animate-pulse">Conectando con soporte...</p>
      </div>
    );
  }

  return (
    <div className="relative h-[700px] bg-[#0a0a0a] rounded-2xl border border-white/5 overflow-hidden shadow-2xl flex flex-col">
      <AnimatePresence mode="wait">

        {/* VISTA: LISTA DE TICKETS */}
        {view === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#0f0f0f] shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <LucideTicket className="text-purple-500" /> Centro de Soporte
                </h2>
                <p className="text-sm text-neutral-400">Gestiona tus consultas y reportes.</p>
              </div>
              <Button
                onClick={() => setView('new')}
                className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20"
              >
                <LucidePlus className="w-4 h-4 mr-2" /> Nuevo Ticket
              </Button>
            </div>

            {/* List - Ocupa el espacio restante */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {tickets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 py-10">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                    <LucideTicket className="w-8 h-8 opacity-50" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-1">Sin tickets</h3>
                  <p className="max-w-xs text-sm mb-6">No tienes consultas activas.</p>
                  <Button variant="outline" onClick={() => setView('new')} className="border-white/10 hover:bg-white/5 text-white">
                    Crear Ticket
                  </Button>
                </div>
              ) : (
                tickets.map((ticket) => {
                  const style = statusStyles[ticket.status as keyof typeof statusStyles] || statusStyles.open;
                  const StatusIcon = style.icon;
                  return (
                    <motion.div
                      layoutId={ticket.id}
                      key={ticket.id}
                      onClick={() => loadTicketDetails(ticket.id)}
                      className="group relative bg-[#151515] hover:bg-[#1a1a1a] border border-white/5 hover:border-white/10 rounded-xl p-4 cursor-pointer transition-all duration-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-neutral-500 bg-black/30 px-1.5 py-0.5 rounded border border-white/5">
                            #{ticket.ticketNumber}
                          </span>
                          <div className={cn("flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border", style.bg, style.color, style.border)}>
                            <StatusIcon className="w-3 h-3" /> {style.label}
                          </div>
                        </div>
                        <span className="text-xs text-neutral-500">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-base font-semibold text-white group-hover:text-purple-300 transition-colors truncate">
                        {ticket.subject}
                      </h4>
                      <div className="flex items-center gap-2 mt-3 text-xs text-neutral-400">
                        <LucideMessageSquare className="w-3 h-3" />
                        <span>{ticket.messageCount || 0} mensajes</span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}

        {/* VISTA: CREAR TICKET */}
        {view === 'new' && (
          <motion.div
            key="new"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="flex flex-col h-full"
          >
            <div className="p-6 border-b border-white/5 bg-[#0f0f0f] flex items-center gap-4 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setView('list')} className="rounded-full hover:bg-white/10 text-white">
                <LucideArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h2 className="text-xl font-bold text-white">Nuevo Ticket</h2>
                <p className="text-sm text-neutral-400">Describe tu problema detalladamente.</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto w-full space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Asunto</label>
                  <Input
                    value={newTicketForm.subject}
                    onChange={(e) => setNewTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Ej: Problema con la instalación..."
                    className="bg-[#151515] border-white/10 focus:border-purple-500/50 text-white h-12"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Descripción</label>
                  <Textarea
                    value={newTicketForm.content}
                    onChange={(e) => setNewTicketForm(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Proporciona todos los detalles posibles..."
                    className="bg-[#151515] border-white/10 focus:border-purple-500/50 text-white min-h-[200px] resize-none p-4 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-[#0f0f0f] flex justify-end gap-3 shrink-0">
              <Button variant="ghost" onClick={() => setView('list')} className="text-neutral-400 hover:text-white">
                Cancelar
              </Button>
              <Button
                onClick={createTicket}
                disabled={isCreatingTicket || !newTicketForm.subject || !newTicketForm.content}
                className="bg-purple-600 hover:bg-purple-700 min-w-[120px]"
              >
                {isCreatingTicket ? <LucideLoader2 className="animate-spin w-4 h-4" /> : 'Enviar Ticket'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* VISTA: DETALLE TICKET (CHAT) */}
        {view === 'ticket' && selectedTicket && (
          <motion.div
            key="ticket"
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
            className="flex flex-col h-full bg-[#0a0a0a]"
          >
            {/* Chat Header - Altura Fija */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0f0f0f] shrink-0 h-16">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setView('list')} className="h-8 w-8 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white">
                  <LucideArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <span className="font-mono text-neutral-500 text-xs">#{selectedTicket.ticketNumber}</span>
                    {selectedTicket.subject}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {(() => {
                      const style = statusStyles[selectedTicket.status as keyof typeof statusStyles];
                      return (
                        <span className={cn("text-[10px] flex items-center gap-1", style.color)}>
                          <style.icon className="w-3 h-3" /> {style.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Area - Flex 1 para ocupar espacio y empujar el input abajo */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#0a0a0a] custom-scrollbar flex flex-col">
              {/* Espaciador flexible al principio para empujar mensajes al fondo si hay pocos (opcional, estilo Discord) */}
              {/* <div className="flex-1" /> */}

              <div className="space-y-6 pb-4">
                {selectedTicket.messages?.map((message) => {
                  const isMe = !message.isStaffMessage;
                  return (
                    <div key={message.id} className={cn("flex gap-3", isMe ? "justify-end" : "justify-start")}>
                      {!isMe && (
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30 shrink-0">
                          <LucideShieldAlert className="w-4 h-4 text-purple-400" />
                        </div>
                      )}
                      <div className={cn(
                        "max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed",
                        isMe
                          ? "bg-purple-600 text-white rounded-br-sm"
                          : "bg-[#1a1a1a] border border-white/5 text-neutral-200 rounded-bl-sm"
                      )}>
                        {!isMe && (
                          <p className="text-[10px] font-bold text-purple-400 mb-1 block">Soporte</p>
                        )}
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <p className={cn("text-[10px] mt-1 text-right", isMe ? "text-purple-200/70" : "text-neutral-500")}>
                          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {isMe && (
                        <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center border border-white/5 shrink-0">
                          <LucideUser className="w-4 h-4 text-neutral-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={scrollRef} />
              </div>
            </div>

            {/* Input Area - Pegado al fondo */}
            {selectedTicket.status !== 'closed' ? (
              <div className="p-4 bg-[#0f0f0f] border-t border-white/5 shrink-0">
                <div className="relative flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      if (e.target.value.length > 0) sendTyping(selectedTicket.id);
                    }}
                    placeholder="Escribe una respuesta..."
                    className="min-h-[50px] max-h-[120px] bg-[#151515] border-white/10 focus:border-purple-500/50 text-white resize-none pr-12 py-3 custom-scrollbar"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                    className="absolute right-2 bottom-2 h-8 w-8 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all"
                  >
                    {sendingMessage ? <LucideLoader2 className="w-4 h-4 animate-spin" /> : <LucideSend className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-neutral-500 mt-2 text-center">
                  Presiona Enter para enviar. Shift + Enter para nueva línea.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-[#0f0f0f] border-t border-white/5 text-center shrink-0">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-800/50 border border-white/5 text-neutral-400 text-sm">
                  <LucideXCircle className="w-4 h-4" /> Este ticket ha sido cerrado.
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};