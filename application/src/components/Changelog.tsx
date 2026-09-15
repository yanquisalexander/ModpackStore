import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

// Versión actual del changelog
const CHANGELOG_ID = 9;

// DIA MES AÑO (DD/MM/YYYY)
const PATCH_NOTES_RELEASE_DATE = '15/09/2026';

const PATCH_NOTES_DATE_STRING = (() => {
  const [day, month, year] = PATCH_NOTES_RELEASE_DATE.split('/').map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
})();

const CHANGELOG_CONTENT = `## 🚀 Modpack Store — La actualización donde literalmente soportamos todo

Bueno, aparentemente nos aburrimos y decidimos actualizar medio universo 😀.
Trae más modloaders, optimizaciones, anuncios (sí, tenemos que comer), herramientas para creadores y una buena dosis de cosas nuevas.

---

### 🧩 Vanilla, Fabric, Quilt, NeoForge, Forge... hasta tu abuela

¿Usás **Fabric**? Sí.
¿Forge? También.
¿NeoForge? Obvio.
¿Quilt? De una.
¿Vanilla? Técnicamente ni siquiera es un modloader, pero **nosotros igual lo bancamos**.

En resumen: **ya soportamos todos los modloaders importantes.**

Si tu modpack usa Java y no necesita invocar a Satanás para arrancar, probablemente estamos good. 👍

---

### 💸 Anuncios... porque necesito comer

Sí, llegó el momento.

Los usuarios gratuitos podrán ver **publicidad en algunas secciones de la aplicación**.

No vamos a poner un anuncio entre cada click ni hacer que tengas que ver un video de 30 segundos para abrir un modpack. La publicidad estará limitada a determinadas partes de la app.

Porque los servidores, la infraestructura y el café no se pagan solos. 🗿

---

### ⚡ Optimizaciones + Java dejó de hacer Java

Hicimos un poco de magia negra en el rendimiento de la aplicación.

La app ahora debería sentirse **más rápida, fluida y menos como si estuviera corriendo en una calculadora Casio**.

También corregimos varios bugs relacionados con **Java** que, en circunstancias muy específicas, podían hacer que el juego simplemente decidiera:

> "nah"

Y se negara a ejecutar.

Ahora debería ser bastante menos dramático. ☕💀

---

### 📢 Creadores: llegó la hora de hacer spam (legalmente)

Los creadores ahora pueden **promocionar sus modpacks directamente dentro de Modpack Store**.

Pero eso no es todo 👀

También permitimos promocionar **servicios externos**.

Sí, **vos, proveedor de hosting**.

Estamos mirando específicamente a vos.

¿Querés promocionar un modpack? ¿Un servidor? ¿Tu hosting?
Ahora tenés herramientas para hacerlo.

---

### 🛠️ Organizaciones: menos sufrimiento administrativo

Rediseñamos completamente la interfaz de administración para creadores.

Las organizaciones ahora tienen una interfaz **más limpia, sencilla y usable**, para que administrar tus proyectos no se sienta como configurar un router del 2007.

Menos clicks.

Menos menús escondidos.

Menos:

> "¿Dónde estaba esta opción?"

Más crear cosas. 🗿

---

### 👤 Perfil público de creador

Ahora los creadores pueden tener su propio **perfil público**.

Podés poner:

* 🖼️ Tu foto de perfil
* 🌄 Una portada
* 📦 Todos tus modpacks públicos agrupados en un solo lugar

Básicamente, tu pequeño rincón del universo Modpack Store.

Mandale tu fotito, poné una portada fachera y hacé como que sabés diseñar. ✨

---

### 💚 Y esto recién empieza...

Cada actualización nos acerca un poco más a convertir Modpack Store en **el lugar donde encontrás, instalás y compartís tus modpacks sin tener que pelearte con Java a las 3 de la mañana**.

Gracias por seguir bancando el proyecto. ❤️

Ahora sí...

**disfrutad de esta versión.**

— El equipo de Modpack Store
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
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>{CHANGELOG_CONTENT}</ReactMarkdown>
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
