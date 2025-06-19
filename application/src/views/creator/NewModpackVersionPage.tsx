import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { ChevronLeft, UploadCloud, FileArchive } from "lucide-react";

export const NewModpackVersionPage = () => {
    const params = useParams<{ modpackId: string }>();
    const [, setLocation] = useLocation();
    const [changelog, setChangelog] = useState("");
    const [modsZip, setModsZip] = useState<File | null>(null);
    const [configsZip, setConfigsZip] = useState<File | null>(null);
    const [resourcesZip, setResourcesZip] = useState<File | null>(null);
    const modsInput = useRef<HTMLInputElement>(null);
    const configsInput = useRef<HTMLInputElement>(null);
    const resourcesInput = useRef<HTMLInputElement>(null);

    // Drag & drop handlers
    const handleDrop = (e: React.DragEvent, setter: (f: File) => void) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setter(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-8">
            <button className="flex items-center gap-2 text-neutral-400 hover:text-white mb-8" onClick={() => setLocation(-1)}>
                <ChevronLeft size={18} /> Volver
            </button>
            <h1 className="text-2xl font-bold mb-6">Subir nueva versión</h1>
            <form className="flex flex-col gap-6">
                <div>
                    <label className="block text-sm font-medium mb-1">Changelog</label>
                    <textarea value={changelog} onChange={e => setChangelog(e.target.value)} className="w-full rounded border px-3 py-2 min-h-[80px]" placeholder="¿Qué hay de nuevo en esta versión?" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Mods (.zip)</label>
                    <div
                        className="border-dashed border-2 rounded p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        onClick={() => modsInput.current?.click()}
                        onDrop={e => handleDrop(e, f => setModsZip(f))}
                        onDragOver={e => e.preventDefault()}
                    >
                        <FileArchive size={32} className="mb-2" />
                        {modsZip ? modsZip.name : "Arrastra aquí el ZIP de mods o haz click para seleccionar"}
                        <input ref={modsInput} type="file" accept=".zip" className="hidden" onChange={e => setModsZip(e.target.files?.[0] || null)} />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Configs (.zip)</label>
                    <div
                        className="border-dashed border-2 rounded p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        onClick={() => configsInput.current?.click()}
                        onDrop={e => handleDrop(e, f => setConfigsZip(f))}
                        onDragOver={e => e.preventDefault()}
                    >
                        <FileArchive size={32} className="mb-2" />
                        {configsZip ? configsZip.name : "Arrastra aquí el ZIP de configs o haz click para seleccionar"}
                        <input ref={configsInput} type="file" accept=".zip" className="hidden" onChange={e => setConfigsZip(e.target.files?.[0] || null)} />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Resources (.zip)</label>
                    <div
                        className="border-dashed border-2 rounded p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        onClick={() => resourcesInput.current?.click()}
                        onDrop={e => handleDrop(e, f => setResourcesZip(f))}
                        onDragOver={e => e.preventDefault()}
                    >
                        <FileArchive size={32} className="mb-2" />
                        {resourcesZip ? resourcesZip.name : "Arrastra aquí el ZIP de resources o haz click para seleccionar"}
                        <input ref={resourcesInput} type="file" accept=".zip" className="hidden" onChange={e => setResourcesZip(e.target.files?.[0] || null)} />
                    </div>
                </div>
                <Button type="submit" className="mt-4 flex items-center gap-2">
                    <UploadCloud size={18} /> Subir versión
                </Button>
            </form>
        </div>
    );
};
