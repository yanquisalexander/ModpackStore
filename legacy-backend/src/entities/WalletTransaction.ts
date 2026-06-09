import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { Wallet } from "./Wallet";
import { User } from "./User";
import { Modpack } from "./Modpack";
import { TransactionType } from "../types/enums";

@Entity({ name: "wallet_transactions" })
export class WalletTransaction extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "wallet_id", type: "uuid" })
    walletId: string;

    @Column({
        name: "type",
        type: "enum",
        enum: TransactionType,
        enumName: "transaction_type"
    })
    type: TransactionType;

    @Column({ name: "amount", type: "decimal", precision: 10, scale: 2 })
    amount: string;

    @Column({ name: "related_user_id", type: "uuid", nullable: true })
    relatedUserId?: string; // user who bought

    @Column({ name: "related_modpack_id", type: "uuid", nullable: true })
    relatedModpackId?: string;

    @Column({ name: "external_transaction_id", type: "varchar", nullable: true })
    externalTransactionId?: string;

    @Column({ name: "metadata", type: "text", nullable: true })
    metadata?: string;

    @Column({ name: "description", type: "text", nullable: true })
    description?: string;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    // Relations
    @ManyToOne(() => Wallet, wallet => wallet.transactions)
    @JoinColumn({ name: "wallet_id" })
    wallet: Wallet;

    @ManyToOne(() => User, user => user.relatedTransactions, { nullable: true })
    @JoinColumn({ name: "related_user_id" })
    relatedUser?: User;

    @ManyToOne(() => Modpack, modpack => modpack.relatedTransactions, { nullable: true })
    @JoinColumn({ name: "related_modpack_id" })
    relatedModpack?: Modpack;
}