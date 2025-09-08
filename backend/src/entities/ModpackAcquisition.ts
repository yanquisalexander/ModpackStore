import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, BaseEntity, Index } from "typeorm";
import { User } from "./User";
import { Modpack } from "./Modpack";
import { AcquisitionMethod, AcquisitionStatus } from "../types/enums";

@Entity({ name: "modpack_acquisitions" })
@Index(["userId", "modpackId"], { unique: true })
@Index(["status"])
@Index(["method"])
export class ModpackAcquisition extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "modpack_id", type: "uuid" })
    modpackId: string;

    @Column({
        name: "method",
        type: "enum",
        enum: AcquisitionMethod,
        enumName: "acquisition_method_enum"
    })
    method: AcquisitionMethod;

    @Column({ name: "transaction_id", type: "text", nullable: true })
    transactionId?: string | null;

    @Column({
        name: "status",
        type: "enum",
        enum: AcquisitionStatus,
        enumName: "acquisition_status",
        default: AcquisitionStatus.ACTIVE
    })
    status: AcquisitionStatus;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    // Relations
    @ManyToOne(() => User, user => user.modpackAcquisitions)
    @JoinColumn({ name: "user_id" })
    user: User;

    @ManyToOne(() => Modpack, modpack => modpack.acquisitions)
    @JoinColumn({ name: "modpack_id" })
    modpack: Modpack;

    // Static methods for finding acquisitions
    static async findUserAcquisition(userId: string, modpackId: string): Promise<ModpackAcquisition | null> {
        return this.findOne({
            where: {
                userId,
                modpackId
            }
        });
    }

    static async findActiveUserAcquisition(userId: string, modpackId: string): Promise<ModpackAcquisition | null> {
        return this.findOne({
            where: {
                userId,
                modpackId,
                status: AcquisitionStatus.ACTIVE
            }
        });
    }

    static async findUserAcquisitions(userId: string): Promise<ModpackAcquisition[]> {
        return this.find({
            where: {
                userId
            },
            relations: ['modpack'],
            order: {
                createdAt: 'DESC'
            }
        });
    }

    static async findModpackAcquisitions(modpackId: string): Promise<ModpackAcquisition[]> {
        return this.find({
            where: {
                modpackId
            },
            relations: ['user'],
            order: {
                createdAt: 'DESC'
            }
        });
    }

    // Instance methods
    isActive(): boolean {
        return this.status === AcquisitionStatus.ACTIVE;
    }

    isSuspended(): boolean {
        return this.status === AcquisitionStatus.SUSPENDED;
    }

    isRevoked(): boolean {
        return this.status === AcquisitionStatus.REVOKED;
    }

    suspend(): void {
        this.status = AcquisitionStatus.SUSPENDED;
    }

    activate(): void {
        this.status = AcquisitionStatus.ACTIVE;
    }

    revoke(): void {
        this.status = AcquisitionStatus.REVOKED;
    }
}