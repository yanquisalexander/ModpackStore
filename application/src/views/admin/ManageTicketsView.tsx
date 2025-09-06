import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
    LucideLoader,
    LucideRefreshCw,
    LucideTicket,
    LucideMessageSquare,
    LucideClock,
    LucideCheck,
    LucideEye,
    LucideSend,
    LucideArrowLeft,
    LucideUser
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { useTicketRealtime } from '@/hooks/useTicketRealtime';
import * as TicketsService from '@/services/tickets';
import type { Ticket, TicketMessage } from '@/services/tickets';

const statusConfig = {
  open: { label: 'Abierto', variant: 'default' as const, icon: LucideClock },
  in_review: { label: 'En Revisión', variant: 'secondary' as const, icon: LucideMessageSquare },
  closed: { label: 'Cerrado', variant: 'outline' as const, icon: LucideCheck }
};

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'open', label: 'Abiertos' },
  { value: 'in_review', label: 'En Revisión' },
  { value: 'closed', label: 'Cerrados' }
];

export const ManageTicketsView: React.FC = () => {
    const { session, sessionTokens } = useAuthentication();
    const { toast } = useToast();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'ticket'>('list');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [newMessage, setNewMessage] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    // Real-time updates for staff
    const { sendTyping } = useTicketRealtime({
        onNewMessage: (data) => {
            // Update the selected ticket if we're viewing it
            if (selectedTicket && data.ticketId === selectedTicket.id && data.message) {
                setSelectedTicket(prev => prev ? {
                    ...prev,
                    messages: [...(prev.messages || []), data.message]
                } : null);
            }
            
            // Update ticket list
            setTickets(prev => prev.map(ticket => 
                ticket.id === data.ticketId 
                    ? { ...ticket, updatedAt: new Date().toISOString(), messageCount: (ticket.messageCount || 0) + 1 }
                    : ticket
            ));
        },
        onNewTicket: (data) => {
            // Refresh tickets list when new ticket is created
            loadTickets();
        }
    });

    // Check if user has staff privileges
    if (!session?.isStaff?.()) {
        return (
            <Alert>
                <AlertDescription>
                    No tienes permisos para acceder a esta sección.
                </AlertDescription>
            </Alert>
        );
    }

    const loadTickets = async () => {
        if (!sessionTokens?.accessToken) return;
        
        setLoading(true);
        try {
            const adminTickets = await TicketsService.getAllTickets(
                sessionTokens.accessToken, 
                statusFilter || undefined
            );
            setTickets(adminTickets);
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
            const ticket = await TicketsService.getAdminTicket(ticketId, sessionTokens.accessToken);
            setSelectedTicket(ticket);
            setView('ticket');
            
            // Mark messages as read
            await TicketsService.markMessagesAsRead(ticketId, sessionTokens.accessToken);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo cargar el ticket',
                variant: 'destructive'
            });
        }
    };

    const sendMessage = async () => {
        if (!sessionTokens?.accessToken || !selectedTicket || !newMessage.trim()) return;

        setSendingMessage(true);
        try {
            const message = await TicketsService.sendAdminMessage(
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
                description: 'Tu respuesta ha sido enviada al usuario'
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

    const updateTicketStatus = async (newStatus: 'open' | 'in_review' | 'closed') => {
        if (!sessionTokens?.accessToken || !selectedTicket) return;

        setUpdatingStatus(true);
        try {
            await TicketsService.updateTicketStatus(
                selectedTicket.id,
                { status: newStatus },
                sessionTokens.accessToken
            );
            
            setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
            toast({
                title: 'Estado actualizado',
                description: `El ticket ha sido marcado como ${statusConfig[newStatus].label.toLowerCase()}`
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo actualizar el estado del ticket',
                variant: 'destructive'
            });
        } finally {
            setUpdatingStatus(false);
        }
    };

    useEffect(() => {
        loadTickets();
    }, [sessionTokens, statusFilter]);

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
                                        Usuario: {selectedTicket.user?.username} ({selectedTicket.user?.email})
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        • Creado {new Date(selectedTicket.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Select 
                                value={selectedTicket.status} 
                                onValueChange={(value: 'open' | 'in_review' | 'closed') => updateTicketStatus(value)}
                                disabled={updatingStatus}
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="open">Abierto</SelectItem>
                                    <SelectItem value="in_review">En Revisión</SelectItem>
                                    <SelectItem value="closed">Cerrado</SelectItem>
                                </SelectContent>
                            </Select>
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
                                        className={`flex ${message.isStaffMessage ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-lg p-3 ${
                                                message.isStaffMessage
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted text-muted-foreground'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm">
                                                    {message.isStaffMessage ? message.sender.username : selectedTicket.user?.username}
                                                </span>
                                                {message.isStaffMessage && (
                                                    <Badge variant="secondary" className="text-xs">Staff</Badge>
                                                )}
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
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Responder al usuario:</label>
                                <div className="flex gap-2">
                                    <Textarea
                                        placeholder="Escribe tu respuesta..."
                                        value={newMessage}
                                        onChange={(e) => {
                                            setNewMessage(e.target.value);
                                            // Send typing indicator
                                            if (e.target.value.length > 0 && selectedTicket) {
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
                                        {sendingMessage ? (
                                            <LucideLoader className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <LucideSend className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
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
                        Gestión de Tickets de Soporte
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Filtrar por estado" />
                            </SelectTrigger>
                            <SelectContent>
                                {statusOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadTickets}
                            disabled={loading}
                        >
                            <LucideRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <LucideLoader className="h-8 w-8 animate-spin" />
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="text-center py-8">
                        <LucideTicket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">No hay tickets</h3>
                        <p className="text-muted-foreground">
                            {statusFilter ? 'No hay tickets con el estado seleccionado.' : 'No se han creado tickets aún.'}
                        </p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ticket</TableHead>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Asunto</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Mensajes</TableHead>
                                <TableHead>Creado</TableHead>
                                <TableHead>Actualizado</TableHead>
                                <TableHead>Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tickets.map((ticket) => {
                                const StatusIcon = statusConfig[ticket.status].icon;
                                
                                return (
                                    <TableRow key={ticket.id}>
                                        <TableCell>
                                            <span className="font-mono text-sm">{ticket.ticketNumber}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <LucideUser className="h-4 w-4" />
                                                <div>
                                                    <div className="font-medium">{ticket.user?.username}</div>
                                                    <div className="text-sm text-muted-foreground">{ticket.user?.email}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-48 truncate" title={ticket.subject}>
                                                {ticket.subject}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={statusConfig[ticket.status].variant}>
                                                <StatusIcon className="h-3 w-3 mr-1" />
                                                {statusConfig[ticket.status].label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">{ticket.messageCount || 0}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">
                                                {new Date(ticket.createdAt).toLocaleDateString()}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">
                                                {new Date(ticket.updatedAt).toLocaleDateString()}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => loadTicketDetails(ticket.id)}
                                            >
                                                <LucideEye className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
};