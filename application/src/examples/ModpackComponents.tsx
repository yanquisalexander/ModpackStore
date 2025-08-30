import React from 'react';
import { CreateModpackInstanceDialog, ModpackUpdateChecker } from '@/components/instance';
import { CreateVersionDialog } from '@/components/creator/CreateVersionDialog';

// Example usage of the new components
const ExampleUsage: React.FC = () => {
    const mockModpack = {
        id: 'modpack-123',
        name: 'Example Modpack',
        publisherId: 'publisher-123',
        versions: [
            {
                id: 'version-1',
                version: '1.0.0',
                mcVersion: '1.20.1',
                forgeVersion: '47.2.0',
                releaseDate: '2024-01-15'
            }
        ]
    };

    const mockInstance = {
        instanceId: 'instance-123',
        instanceName: 'My Instance',
        modpackId: 'modpack-123',
        modpackVersionId: 'version-1'
    };

    return (
        <div>
            <CreateModpackInstanceDialog
                isOpen={false}
                onClose={() => {}}
                onSuccess={() => {}}
                modpack={mockModpack}
            />
            
            <ModpackUpdateChecker
                instance={mockInstance}
                onUpdate={() => {}}
            />
            
            <CreateVersionDialog
                isOpen={false}
                onClose={() => {}}
                onSuccess={() => {}}
                modpack={mockModpack}
            />
        </div>
    );
};

export default ExampleUsage;