import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';

// Versión actual del changelog
const CHANGELOG_ID = 3;

const CHANGELOG_CONTENT = `## 🎨 Rediseño de la Interfaz
Nueva barra lateral: Navegación más clara y rápida, inspirada en interfaces familiares como Discord.

Diseño gaming-friendly: Estilo moderno y optimizado para largas sesiones.

Mejor organización: Acceso más intuitivo a modpacks, instancias y configuraciones.

---

## 🚀 Mejoras Generales
- Corrección de bugs menores para mejorar la estabilidad
- Rendimiento optimizado al cargar la biblioteca de modpacks
- Animaciones fluidas al cambiar entre secciones

---

## 🌟 Próximamente
- Personalización de la barra lateral (colores y secciones)
- Atajos de teclado para navegación más rápida
- Widgets para estadísticas de juego y actividad

🙌 ¡Gracias por acompañarnos en la evolución de Modpack Store!`;

export const Changelog: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkShouldShow = async () => {
      try {
        const lastChangelogId = await invoke<number | null>('get_config_value', {
          key: 'lastChangelogId'
        });
        const currentStoredId = lastChangelogId ?? 0;
        if (currentStoredId !== CHANGELOG_ID) {
          setIsOpen(true);
        }
      } catch {
        setIsOpen(true);
      }
    };
    checkShouldShow();
  }, []);

  const handleClose = async () => {
    setLoading(true);
    try {
      await invoke('set_config', {
        key: 'lastChangelogId',
        value: CHANGELOG_ID
      });
    } finally {
      setIsOpen(false);
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => { }}>
      <DialogContent className="sm:max-w-xl max-w-[90vw] max-h-[85vh] flex flex-col p-0 rounded-2xl overflow-hidden">

        {/* Imagen arriba */}
        <div className="w-full h-48 bg-gradient-to-r from-fuchsia-500 to-indigo-600 flex items-center justify-center">
          <img
            src="https://external-preview.redd.it/78RY0XJPZBdEIGhoEeNNt0wLdHJFP1MoYsUcpCBQlF0.jpg?width=1080&crop=smart&auto=webp&s=7927bb5afa8e4f9c02c389ed30427611e40ce848"
            alt="Novedades"
            className="h-40 w-full object-cover"
          />
        </div>


        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <h2 className="text-lg font-bold">Novedades</h2>
            <p className="text-xs text-gray-400">29 de septiembre de 2025</p>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none space-y-3
            prose-h2:text-sm prose-h2:uppercase prose-h2:font-bold prose-h2:text-indigo-400
            prose-hr:border-gray-700
            prose-p:text-gray-200 prose-li:text-gray-200">
            <ReactMarkdown>{CHANGELOG_CONTENT}</ReactMarkdown>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-end bg-gray-900/40">
          <Button
            onClick={handleClose}
            disabled={loading}
            className="min-w-24"
          >
            {loading ? 'Cerrando...' : 'Entendido'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Changelog;
