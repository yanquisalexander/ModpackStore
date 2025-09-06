import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, BaseEntity } from "typeorm";
import { User } from "./User";
import { TicketMessage } from "./TicketMessage";
import { TicketStatus } from "@/types/enums";

@Entity({ name: "tickets" })
export class Ticket extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "ticket_number", type: "int", unsigned: true, unique: true, generated: "increment" })
    ticketNumber: number;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "subject", type: "varchar", length: 255 })
    subject: string;

    @Column({
        name: "status",
        type: "enum",
        enum: TicketStatus,
        default: TicketStatus.OPEN
    })
    status: TicketStatus;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => User, user => user.tickets)
    @JoinColumn({ name: "user_id" })
    user: User;

    @OneToMany(() => TicketMessage, message => message.ticket)
    messages: TicketMessage[];

    // Helper methods
    static async findByIdWithRelations(id: string): Promise<Ticket | null> {
        // Use query builder so we can order related messages consistently
        return await Ticket.createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('ticket.messages', 'messages')
            .leftJoinAndSelect('messages.sender', 'sender')
            .where('ticket.id = :id', { id })
            .orderBy('messages.created_at', 'ASC')
            .getOne();
    }

    static async findUserTickets(userId: string): Promise<Ticket[]> {
        // Include messages but we only need counts for most callers; order tickets by updatedAt
        return await Ticket.createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.messages', 'messages')
            .where('ticket.userId = :userId', { userId })
            .orderBy('ticket.updated_at', 'DESC')
            .getMany();
    }

    static async findAllTickets(): Promise<Ticket[]> {
        return await Ticket.createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('ticket.messages', 'messages')
            .leftJoinAndSelect('messages.sender', 'sender')
            .orderBy('ticket.updated_at', 'DESC')
            .addOrderBy('messages.created_at', 'ASC')
            .getMany();
    }

    static async findByStatus(status: TicketStatus): Promise<Ticket[]> {
        return await Ticket.createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('ticket.messages', 'messages')
            .leftJoinAndSelect('messages.sender', 'sender')
            .where('ticket.status = :status', { status })
            .orderBy('ticket.updated_at', 'DESC')
            .addOrderBy('messages.created_at', 'ASC')
            .getMany();
    }

    // Generate padded ticket number for UI
    getTicketNumber(): string {
        const numericPart = this.ticketNumber;
        return `#${numericPart.toString().padStart(3, '0')}`;
    }
}