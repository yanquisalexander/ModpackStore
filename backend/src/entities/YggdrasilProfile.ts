import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BaseEntity, Index } from "typeorm";

@Entity({ name: "yggdrasil_profiles" })
@Index(["userId"], { unique: true })
export class YggdrasilProfile extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "user_id", type: "uuid", unique: true })
    userId: string;

    @Column({ name: "minecraft_uuid", type: "varchar", length: 36 })
    minecraftUuid: string;

    @Column({ name: "minecraft_username", type: "varchar", length: 32 })
    minecraftUsername: string;

    @Column({ name: "skin_url", type: "text", nullable: true })
    skinUrl?: string | null;

    @Column({ name: "skin_model", type: "varchar", length: 10, default: "classic" })
    skinModel: string; // "classic" or "slim"

    @Column({ name: "cape_url", type: "text", nullable: true })
    capeUrl?: string | null;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Convert to Yggdrasil profile format
    toYggdrasilFormat() {
        const properties: any[] = [];

        if (this.skinUrl) {
            const textureValue = {
                timestamp: Date.now(),
                profileId: this.minecraftUuid.replace(/-/g, ''),
                profileName: this.minecraftUsername,
                textures: {
                    SKIN: {
                        url: this.skinUrl,
                        metadata: this.skinModel === "slim" ? { model: "slim" } : undefined
                    },
                    ...(this.capeUrl ? { CAPE: { url: this.capeUrl } } : {})
                }
            };

            const encodedValue = Buffer.from(JSON.stringify(textureValue)).toString('base64');
            properties.push({
                name: "textures",
                value: encodedValue
            });
        }

        return {
            id: this.minecraftUuid.replace(/-/g, ''),
            name: this.minecraftUsername,
            properties
        };
    }
}
