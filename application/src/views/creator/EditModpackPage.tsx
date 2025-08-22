import {useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ChevronLeft, UploadCloud } from "lucide-react";

export const EditModpackPage = () => {
    const params = useParams<{ modpackId: string }>();
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [banner, setBanner] = useState<File | null>(null);
    const [icon, setIcon] = useState<File | null>(null);

    // Mock: cargar datos actuales del modpack si es necesario

    return (
        <div className="max-w-2xl mx-auto p-8">
            <button className="flex items-center gap-2 text-neutral-400 hover:text-white mb-8" onClick={() => navigate(-1)}>
                <ChevronLeft size={18} /> Volver
            </button>
            <h1 className="text-2xl font-bold mb-6">Editar Modpack</h1>
            <form className="flex flex-col gap-6">
                <div>
                    <label className="block text-sm font-medium mb-1">Nombre</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="Nombre del modpack" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Descripción</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded border px-3 py-2 min-h-[80px]" placeholder="Descripción" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Icono</label>
                    <input type="file" accept="image/*" onChange={e => setIcon(e.target.files?.[0] || null)} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Banner</label>
                    <input type="file" accept="image/*" onChange={e => setBanner(e.target.files?.[0] || null)} />
                </div>
                <Button type="submit" className="mt-4 flex items-center gap-2">
                    <UploadCloud size={18} /> Guardar cambios
                </Button>
            </form>
        </div>
    );
};
