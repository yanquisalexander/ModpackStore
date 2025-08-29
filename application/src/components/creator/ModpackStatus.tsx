export type ModpackStatus = 'draft' | 'published' | 'archived' | 'deleted';

export const ModpackStatusLabels: Record<ModpackStatus, { text: string; textColor: string; bgColor: string }> = {
    draft: { text: 'Borrador', textColor: 'text-gray-800', bgColor: 'bg-gray-300' },
    published: { text: 'Publicado', textColor: 'text-green-800', bgColor: 'bg-green-300' },
    archived: { text: 'Archivado', textColor: 'text-yellow-800', bgColor: 'bg-yellow-300' },
    deleted: { text: 'Eliminado', textColor: 'text-red-800', bgColor: 'bg-red-300' },
};

export const ModpackStatus = ({ status }: { status: ModpackStatus }) => {
    const { text, textColor, bgColor } = ModpackStatusLabels[status];
    return <span className={`${textColor} ${bgColor} px-3 py-1 rounded-full font-semibold`}>{text}</span>;
};