import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, BaseEntity, OneToMany } from "typeorm";
import { User } from "./User";

@Entity({ name: "patreon_tiers" })
export class PatreonTier extends BaseEntity {
    @PrimaryColumn({ type: "text" })
    id: string; // Patreon tier UUID

    @Column({ type: "text" })
    name: string;

    @Column({ type: "text", nullable: true })
    description?: string | null;

    @Column({ name: "amount_cents", type: "integer" })
    amountCents: number;

    @Column({ type: "boolean", default: true })
    active: boolean;

    @Column({ type: "jsonb", nullable: true })
    metadata?: Record<string, any> | null;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @OneToMany(() => User, user => user.patreonTier)
    users: User[];
}
