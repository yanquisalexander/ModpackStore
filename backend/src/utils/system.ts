import { User } from "@/entities/User";
import { UserRole } from "@/types/enums";

export const SYSTEM_EMAIL = "system@app.local";


/* 
    Generate (if not exists) the System User
*/

export const generateSystemUser = async () => {
    const systemUser = await User.findOne({ where: { email: SYSTEM_EMAIL } });

    if (!systemUser) {

        console.log('System user not found, creating...');
        await User.insert({
            email: SYSTEM_EMAIL,
            avatarUrl: '/images/system-avatar.webp',
            username: "system",
            discordId: "userisnotauthenticable",
            role: UserRole.SYSTEM
        });
    }
};