import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, BaseEntity } from "typeorm";
import { Publisher } from "./Publisher";
import { WalletTransaction } from "./WalletTransaction";

@Entity({ name: "wallets" })
export class Wallet extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "publisher_id", type: "uuid" })
    publisherId: string;

    @Column({ name: "balance", type: "decimal", precision: 10, scale: 2, default: "0" })
    balance: string;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Publisher, publisher => publisher.wallets)
    @JoinColumn({ name: "publisher_id" })
    publisher: Publisher;

    @OneToMany(() => WalletTransaction, transaction => transaction.wallet)
    transactions: WalletTransaction[];
}