import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { User } from "./User";
import { Modpack } from "./Modpack";

@Entity({ name: "user_purchases" })
export class UserPurchase extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "modpack_id", type: "uuid" })
    modpackId: string;

    @Column({ name: "price_paid", type: "decimal", precision: 10, scale: 2 })
    pricePaid: string;

    @CreateDateColumn({ name: "purchased_at" })
    purchasedAt: Date;

    // Relations
    @ManyToOne(() => User, user => user.purchases)
    @JoinColumn({ name: "user_id" })
    user: User;

    @ManyToOne(() => Modpack, modpack => modpack.purchases)
    @JoinColumn({ name: "modpack_id" })
    modpack: Modpack;
}