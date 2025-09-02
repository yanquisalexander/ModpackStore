import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { User } from "./User";

@Entity({ name: "sessions" })
export class Session extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "device_info", type: "jsonb", default: {} })
    deviceInfo: Record<string, any>;

    @Column({ name: "location_info", type: "jsonb", default: {} })
    locationInfo: Record<string, any>;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => User, user => user.sessions)
    @JoinColumn({ name: "user_id" })
    user: User;

    // Static finder methods
    static async findBySessionId(sessionId: number): Promise<Session | null> {
        return await Session.findOne({ where: { id: sessionId } });
    }
}