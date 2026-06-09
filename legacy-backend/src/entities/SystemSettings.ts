import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BaseEntity } from "typeorm";

@Entity({ name: "system_settings" })
export class SystemSettings extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "key", type: "varchar", length: 255, unique: true })
    key: string;

    @Column({ name: "value", type: "text", nullable: true })
    value?: string | null;

    @Column({ name: "description", type: "text", nullable: true })
    description?: string | null;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    // Static methods for common operations
    static async get(key: string): Promise<string | null> {
        const setting = await SystemSettings.findOne({ where: { key } });
        return setting?.value || null;
    }

    static async set(key: string, value: string, description?: string): Promise<SystemSettings> {
        let setting = await SystemSettings.findOne({ where: { key } });
        
        if (setting) {
            setting.value = value;
            if (description !== undefined) {
                setting.description = description;
            }
        } else {
            setting = SystemSettings.create({
                key,
                value,
                description
            });
        }
        
        return await setting.save();
    }

    static async getBoolean(key: string, defaultValue = false): Promise<boolean> {
        const value = await SystemSettings.get(key);
        if (value === null) return defaultValue;
        return value === 'true' || value === '1';
    }

    static async setBoolean(key: string, value: boolean, description?: string): Promise<SystemSettings> {
        return await SystemSettings.set(key, value.toString(), description);
    }

    // Terms and Conditions specific methods
    static async getToSContent(): Promise<string | null> {
        return await SystemSettings.get('terms_and_conditions_content');
    }

    static async setToSContent(content: string): Promise<SystemSettings> {
        return await SystemSettings.set(
            'terms_and_conditions_content',
            content,
            'Terms and Conditions content in markdown format'
        );
    }

    static async isToSEnabled(): Promise<boolean> {
        return await SystemSettings.getBoolean('terms_and_conditions_enabled', false);
    }

    static async setToSEnabled(enabled: boolean): Promise<SystemSettings> {
        return await SystemSettings.setBoolean(
            'terms_and_conditions_enabled',
            enabled,
            'Whether Terms and Conditions acceptance is required'
        );
    }
}