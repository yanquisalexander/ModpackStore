import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';

// Versión actual del changelog
const CHANGELOG_ID = 7;

// DIA MES AÑO (DD/MM/YYYY)
const PATCH_NOTES_RELEASE_DATE = '13/10/2025';

const PATCH_NOTES_DATE_STRING = (() => {
  const [day, month, year] = PATCH_NOTES_RELEASE_DATE.split('/').map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
})();

const CHANGELOG_CONTENT = `## 🎨 Personalizá tu launcher — Nuevo sistema de temas (BETA)

- 🖌️ **Sistema de temas activado (BETA)**  
  Ahora podés cambiar el aspecto de Modpack Store con un par de clics. Probá los **3 temas gratuitos** incluidos y dale estilo a tu experiencia.

- 🌟 **Preparando Modpack Store+**  
  Se empieza a integrar nuestro sistema de suscripción para quienes quieren ir más allá:
  - Todos los temas desbloqueados  
  - Acceso anticipado a funciones experimentales  
  - Soporte prioritario y rol especial en Discord  
  - Velocidades de descarga mejoradas en modpacks

- ⚙️ **Optimización de carga**  
  Seguimos mejorando el rendimiento general de la app para que todo responda más rápido, incluso tus clics impulsivos.

---

Gracias por seguir usando Modpack Store. Cada actualización te da más control, más estilo y más poder. 💚
`;

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
        <div className="w-full h-48  flex items-center justify-center">
          <img
            /* Para prevenir caché, ya que siempre usaremos el mismo nombre de imagen */
            src={`/images/patch-notes.webp?${Date.now()}`}
            alt="Novedades"
            className="h-48 w-full object-cover object-top"
          />
        </div>


        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 space-y-3">
          <div>
            <h2 className="text-lg font-bold">Novedades</h2>
            <p className="text-xs text-gray-400">{PATCH_NOTES_DATE_STRING}</p>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none space-y-1
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
