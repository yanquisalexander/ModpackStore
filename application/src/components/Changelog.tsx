import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';

// Versión actual del changelog
const CHANGELOG_ID = 8;

// DIA MES AÑO (DD/MM/YYYY)
const PATCH_NOTES_RELEASE_DATE = '03/11/2025';

const PATCH_NOTES_DATE_STRING = (() => {
  const [day, month, year] = PATCH_NOTES_RELEASE_DATE.split('/').map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
})();

const CHANGELOG_CONTENT = `## 🚀 ¡Modpack Store 1.0 ya está aquí! — Fin de la Beta 🎉

Después de meses en beta (y muchas tazas de café), **Modpack Store** alcanza su **primera versión oficial**.  
Y sí, esto viene cargado de mejoras, estabilidad y un toque de magia ✨

---

### 🧵 Soporte estable para Fabric  
Ya podés disfrutar de tus modpacks favoritos con **Fabric** sin miedo a crasheos raros.  
Más compatibilidad, más estabilidad, más diversión.

---

### 💚 Recomendaciones y modpacks similares  
¿Te gustó un modpack? Ahora te sugerimos otros que podrían encantarte 💫  
El sistema aprende de tus likes y te muestra lo mejor del universo Modpack Store.

---

### ⚡ Más rápido que nunca  
Actualizamos la infraestructura para que **todo cargue más fluido**.  
Desde el inicio hasta las descargas, cada clic ahora se siente instantáneo. ⚙️💨

---

### 💬 Tickets en tiempo real  
El sistema de soporte ahora **te notifica en vivo** cuando hay nuevas respuestas o mensajes.  
Y sí, también hay un **contador de notificaciones no leídas** — porque a quién no le gusta ver numeritos rojos.

---

### 🌐 Próximamente: funciones sociales  
Durante las próximas semanas iremos activando gradualmente:
- 🕹️ **Play Together** — conectate con tus amigos directamente desde el launcher.  
- 🤝 **Instance Sharing** — compartí tus instancias personalizadas con un clic.  

El multijugador nunca se sintió tan fácil. 👀

---

### 🧑‍💻 Creadores, esto es para ustedes  
- Ahora pueden usar **Markdown** en sus changelogs y descripciones.  
  ¡Sí! **Imágenes, gifs de gatos, memes y todo lo demás** 🐱✨  
- Si usás **Prelaunch Appearance**, ahora podés aprovechar **variables dinámicas**, como:  
  \`Hola $mcAccountName\` 👋  
  Hacelo sentir personal, único y especial.

---

Gracias por acompañarnos hasta acá 💚  
Esto recién empieza, y lo mejor aún está por venir.  
**— El equipo de Modpack Store**`;

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
