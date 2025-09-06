import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, BaseEntity } from "typeorm";
import { User } from "./User";
import { TicketMessage } from "./TicketMessage";
import { TicketStatus } from "@/types/enums";

@Entity({ name: "tickets" })
export class Ticket extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

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

    @OneToMany(() => TicketMessage, message => message.ticket, { cascade: true })
    messages: TicketMessage[];

    // Helper methods
    static async findByIdWithRelations(id: string): Promise<Ticket | null> {
        return await Ticket.findOne({
            where: { id },
            relations: ["user", "messages", "messages.sender"]
        });
    }

    static async findUserTickets(userId: string): Promise<Ticket[]> {
        return await Ticket.find({
            where: { userId },
            relations: ["messages"],
            order: { updatedAt: "DESC" }
        });
    }

    static async findAllTickets(): Promise<Ticket[]> {
        return await Ticket.find({
            relations: ["user", "messages"],
            order: { updatedAt: "DESC" }
        });
    }

    static async findByStatus(status: TicketStatus): Promise<Ticket[]> {
        return await Ticket.find({
            where: { status },
            relations: ["user", "messages"],
            order: { updatedAt: "DESC" }
        });
    }

    // Generate padded ticket number for UI
    getTicketNumber(): string {
        // Extract numeric part from UUID for display purposes
        const numericPart = parseInt(this.id.replace(/\D/g, '').substring(0, 6)) || 1;
        return `#${numericPart.toString().padStart(3, '0')}`;
    }
}