import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, BaseEntity, JoinColumn } from "typeorm";
import { Ticket } from "./Ticket";
import { User } from "./User";

@Entity({ name: "ticket_messages" })
export class TicketMessage extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "ticket_id", type: "uuid" })
    ticketId: string;

    @Column({ name: "sender_id", type: "uuid" })
    senderId: string;

    @Column({ name: "content", type: "text" })
    content: string;

    @Column({ name: "is_staff_message", type: "boolean", default: false })
    isStaffMessage: boolean;

    @Column({ name: "is_read_by_staff", type: "boolean", default: false })
    isReadByStaff: boolean;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    // Relations
    @ManyToOne(() => Ticket, ticket => ticket.messages)
    @JoinColumn({ name: "ticket_id" })
    ticket: Ticket;

    @ManyToOne(() => User)
    @JoinColumn({ name: "sender_id" })
    sender: User;

    // Helper methods
    static async findTicketMessages(ticketId: string): Promise<TicketMessage[]> {
        return await TicketMessage.find({
            where: { ticketId },
            relations: ["sender"],
            order: { createdAt: "ASC" }
        });
    }

    static async markStaffMessagesAsRead(ticketId: string): Promise<void> {
        await TicketMessage.update(
            { ticketId, isStaffMessage: false },
            { isReadByStaff: true }
        );
    }

    // Check if sender is staff (support, admin, or superadmin)
    isFromStaff(): boolean {
        return this.isStaffMessage;
    }
}