import React from 'react';
import { MemberPermissionsDialog } from '@/components/publisher/MemberPermissionsDialog';
import { PublisherMemberWithPermissions } from '@/services/publisherPermissions.service';

// Demo component to showcase the permissions dialog
export const PermissionsDemo: React.FC = () => {
    const [open, setOpen] = React.useState(true);

    // Mock member data for demo
    const mockMember: PublisherMemberWithPermissions = {
        id: "1",
        userId: "user-123",
        role: "member",
        createdAt: new Date().toISOString(),
        user: {
            id: "user-123",
            username: "demo_user",
            email: "demo@example.com",
            avatarUrl: "https://via.placeholder.com/40"
        },
        scopes: [
            {
                id: "scope-1",
                publisherId: "pub-123",
                permissions: {
                    modpackView: true,
                    modpackModify: false,
                    modpackManageVersions: false,
                    modpackPublish: false,
                    modpackDelete: false,
                    modpackManageAccess: false,
                    publisherManageCategoriesTags: false,
                    publisherViewStats: true
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ]
    };

    return (
        <div className="p-8 bg-background min-h-screen">
            <h1 className="text-2xl font-bold mb-4">Demo: Gestión de Permisos Granulares</h1>
            <p className="text-muted-foreground mb-8">
                Sistema de permisos granulares para Publishers de ModpackStore
            </p>

            <button 
                onClick={() => setOpen(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
                Abrir Gestión de Permisos
            </button>

            <MemberPermissionsDialog
                member={mockMember}
                publisherId="demo-publisher"
                accessToken="demo-token"
                open={open}
                onOpenChange={setOpen}
                onPermissionsChanged={() => {
                    console.log('Permissions changed');
                }}
            />
        </div>
    );
};