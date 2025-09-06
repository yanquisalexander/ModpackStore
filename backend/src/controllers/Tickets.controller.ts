import { Context } from 'hono';
import { APIError } from '@/lib/APIError';
import { AuthVariables } from "@/middlewares/auth.middleware";
import { Ticket } from '@/entities/Ticket';
import { TicketMessage } from '@/entities/TicketMessage';
import { TicketStatus } from '@/types/enums';
import { WebSocketManager } from '@/services/websocket.service';

export class TicketsController {
    /**
     * Create a new support ticket
     */
    static async createTicket(c: Context<{ Variables: AuthVariables }>) {
        const user = c.get('user');
        if (!user) {
            throw new APIError(401, 'Authentication required', 'USER_NOT_AUTHENTICATED');
        }

        const { subject, content } = await c.req.json();

        if (!subject || !content) {
            throw new APIError(400, 'Subject and content are required', 'MISSING_REQUIRED_FIELDS');
        }

        // Create ticket
        const ticket = Ticket.create({
            userId: user.id,
            subject: subject.trim(),
            status: TicketStatus.OPEN
        });

        const savedTicket = await ticket.save();

        // Create initial message
        const message = TicketMessage.create({
            ticketId: savedTicket.id,
            senderId: user.id,
            content: content.trim(),
            isStaffMessage: false,
            isReadByStaff: false
        });

        await message.save();

        // Load ticket with relations for response
        const ticketWithRelations = await Ticket.findByIdWithRelations(savedTicket.id);

        // Notify staff via WebSocket
        const wsManager = WebSocketManager.getInstance();
        wsManager.broadcastToStaff('new_ticket', {
            ticket: ticketWithRelations,
            ticketNumber: savedTicket.getTicketNumber()
        });

        return c.json({
            data: {
                id: ticketWithRelations?.id,
                type: 'ticket',
                attributes: {
                    subject: ticketWithRelations?.subject,
                    status: ticketWithRelations?.status,
                    ticketNumber: savedTicket.getTicketNumber(),
                    createdAt: ticketWithRelations?.createdAt,
                    updatedAt: ticketWithRelations?.updatedAt,
                    messages: ticketWithRelations?.messages?.map(msg => ({
                        id: msg.id,
                        content: msg.content,
                        isStaffMessage: msg.isStaffMessage,
                        createdAt: msg.createdAt,
                        sender: {
                            id: msg.sender.id,
                            username: msg.sender.username
                        }
                    }))
                }
            }
        });
    }

    /**
     * Get user's tickets
     */
    static async getUserTickets(c: Context<{ Variables: AuthVariables }>) {
        const user = c.get('user');
        if (!user) {
            throw new APIError(401, 'Authentication required', 'USER_NOT_AUTHENTICATED');
        }

        const tickets = await Ticket.findUserTickets(user.id);

        return c.json({
            data: tickets.map(ticket => ({
                id: ticket.id,
                type: 'ticket',
                attributes: {
                    subject: ticket.subject,
                    status: ticket.status,
                    ticketNumber: ticket.getTicketNumber(),
                    createdAt: ticket.createdAt,
                    updatedAt: ticket.updatedAt,
                    messageCount: ticket.messages?.length || 0
                }
            }))
        });
    }

    /**
     * Get all tickets (staff only)
     */
    static async getAllTickets(c: Context<{ Variables: AuthVariables }>) {
        const user = c.get('user');
        if (!user || !user.isStaff()) {
            throw new APIError(403, 'Access denied - staff only', 'ACCESS_DENIED');
        }

        const status = c.req.query('status') as TicketStatus;
        const tickets = status ? await Ticket.findByStatus(status) : await Ticket.findAllTickets();

        return c.json({
            data: tickets.map(ticket => ({
                id: ticket.id,
                type: 'ticket',
                attributes: {
                    subject: ticket.subject,
                    status: ticket.status,
                    ticketNumber: ticket.getTicketNumber(),
                    createdAt: ticket.createdAt,
                    updatedAt: ticket.updatedAt,
                    messageCount: ticket.messages?.length || 0,
                    user: {
                        id: ticket.user.id,
                        username: ticket.user.username,
                        email: ticket.user.email
                    }
                }
            }))
        });
    }

    /**
     * Get ticket by ID
     */
    static async getTicket(c: Context<{ Variables: AuthVariables }>) {
        const user = c.get('user');
        if (!user) {
            throw new APIError(401, 'Authentication required', 'USER_NOT_AUTHENTICATED');
        }

        const ticketId = c.req.param('id');
        const ticket = await Ticket.findByIdWithRelations(ticketId);

        if (!ticket) {
            throw new APIError(404, 'Ticket not found', 'TICKET_NOT_FOUND');
        }

        // Users can only access their own tickets, staff can access any
        if (ticket.userId !== user.id && !user.isStaff()) {
            throw new APIError(403, 'Access denied', 'ACCESS_DENIED');
        }

        return c.json({
            data: {
                id: ticket.id,
                type: 'ticket',
                attributes: {
                    subject: ticket.subject,
                    status: ticket.status,
                    ticketNumber: ticket.getTicketNumber(),
                    createdAt: ticket.createdAt,
                    updatedAt: ticket.updatedAt,
                    user: user.isStaff() ? {
                        id: ticket.user.id,
                        username: ticket.user.username,
                        email: ticket.user.email
                    } : undefined,
                    messages: ticket.messages?.map(msg => ({
                        id: msg.id,
                        content: msg.content,
                        isStaffMessage: msg.isStaffMessage,
                        createdAt: msg.createdAt,
                        sender: {
                            id: msg.sender.id,
                            username: user.isStaff() ? msg.sender.username :
                                (msg.isStaffMessage ? 'Soporte de Modpack Store' : msg.sender.username)
                        }
                    }))
                }
            }
        });
    }

    /**
     * Send message to ticket
     */
    static async sendMessage(c: Context<{ Variables: AuthVariables }>) {
        const user = c.get('user');
        if (!user) {
            throw new APIError(401, 'Authentication required', 'USER_NOT_AUTHENTICATED');
        }

        const ticketId = c.req.param('id');
        console.log(`Sending message to ticket ${ticketId}`);
        const { content } = await c.req.json();

        if (!content || !content.trim()) {
            throw new APIError(400, 'Message content is required', 'MISSING_MESSAGE_CONTENT');
        }

        const ticket = await Ticket.findByIdWithRelations(ticketId);
        if (!ticket) {
            throw new APIError(404, 'Ticket not found', 'TICKET_NOT_FOUND');
        }

        // Users can only message their own tickets, staff can message any
        if (ticket.userId !== user.id && !user.isStaff()) {
            throw new APIError(403, 'Access denied', 'ACCESS_DENIED');
        }

        console.log(ticket)

        // Create message
        const message = TicketMessage.create({
            ticketId: ticket.id,
            senderId: user.id,
            content: content.trim(),
            isStaffMessage: user.isStaff(),
            isReadByStaff: false
        });

        console.log(`Message created: ${JSON.stringify(message)}`);

        const savedMessage = await message.save();

        // Update ticket timestamp using direct update to avoid persisting loaded relations
        await Ticket.update({ id: ticket.id }, { updatedAt: new Date() });

        // Load message with sender for response
        const messageWithSender = await TicketMessage.findOne({
            where: { id: savedMessage.id },
            relations: ['sender']
        });

        // Broadcast message via WebSocket
        const wsManager = WebSocketManager.getInstance();
        const messageData = {
            ticketId: ticket.id,
            message: {
                id: messageWithSender!.id,
                content: messageWithSender!.content,
                isStaffMessage: messageWithSender!.isStaffMessage,
                createdAt: messageWithSender!.createdAt,
                sender: {
                    id: messageWithSender!.sender.id,
                    username: messageWithSender!.sender.username
                }
            }
        };

        // Send to ticket owner
        wsManager.sendToUser(ticket.userId, 'new_message', messageData);

        // Send to all staff
        wsManager.broadcastToStaff('new_message', messageData);

        return c.json({
            data: {
                id: messageWithSender!.id,
                type: 'ticket_message',
                attributes: {
                    content: messageWithSender!.content,
                    isStaffMessage: messageWithSender!.isStaffMessage,
                    createdAt: messageWithSender!.createdAt,
                    sender: {
                        id: messageWithSender!.sender.id,
                        username: messageWithSender!.sender.username
                    }
                }
            }
        });
    }

    /**
     * Update ticket status (staff only)
     */
    static async updateTicketStatus(c: Context<{ Variables: AuthVariables }>) {
        const user = c.get('user');
        if (!user || !user.isStaff()) {
            throw new APIError(403, 'Access denied - staff only', 'ACCESS_DENIED');
        }

        const ticketId = c.req.param('id');
        const { status } = await c.req.json();

        if (!status || !Object.values(TicketStatus).includes(status)) {
            throw new APIError(400, 'Valid status is required', 'INVALID_STATUS');
        }

        const ticket = await Ticket.findByIdWithRelations(ticketId);
        if (!ticket) {
            throw new APIError(404, 'Ticket not found', 'TICKET_NOT_FOUND');
        }

        ticket.status = status;
        await ticket.save();

        // Notify user via WebSocket
        const wsManager = WebSocketManager.getInstance();
        wsManager.sendToUser(ticket.userId, 'ticket_status_updated', {
            ticketId: ticket.id,
            status: ticket.status,
            ticketNumber: ticket.getTicketNumber()
        });

        return c.json({
            data: {
                id: ticket.id,
                type: 'ticket',
                attributes: {
                    status: ticket.status
                }
            }
        });
    }

    /**
     * Mark messages as read by staff
     */
    static async markMessagesAsRead(c: Context<{ Variables: AuthVariables }>) {
        const user = c.get('user');
        if (!user || !user.isStaff()) {
            throw new APIError(403, 'Access denied - staff only', 'ACCESS_DENIED');
        }

        const ticketId = c.req.param('id');
        await TicketMessage.markStaffMessagesAsRead(ticketId);

        return c.json({
            data: {
                type: 'success',
                attributes: {
                    message: 'Messages marked as read'
                }
            }
        });
    }
}