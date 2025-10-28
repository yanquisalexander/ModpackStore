# Sistema de Internacionalización (i18n) - Modpack Store

Este documento explica cómo usar el sistema de internacionalización implementado en Modpack Store.

## Arquitectura

El sistema de i18n consta de tres partes principales:

1. **Backend (Rust)**: Maneja la carga de archivos YML y envío de traducciones al frontend
2. **Frontend (React)**: Hooks y providers para consumir traducciones
3. **Archivos de traducción**: Archivos YML organizados por idioma

## Estructura de archivos

```
application/src-tauri/resources/i18n/
├── en.yml          # Archivo base en inglés
├── es-419.yml      # Español (Latinoamérica)
└── pt-BR.yml       # Portugués (Brasil) - futuro

application/src/
├── hooks/
│   └── useI18n.ts              # Hook principal de i18n
├── providers/
│   └── I18nProvider.tsx        # Provider de contexto
└── components/
    └── I18nExample.tsx         # Ejemplo de uso
```

## Uso en React

### Hook básico

```tsx
import { useI18n } from '@/hooks/useI18n';

function MyComponent() {
  const { t, language, setLanguage } = useI18n();

  return (
    <div>
      <h1>{t('common.explore')}</h1>
      <button onClick={() => setLanguage('es-419')}>
        {t('settings.language')}
      </button>
    </div>
  );
}
```

### Contexto (recomendado para componentes profundos)

```tsx
import { useI18nContext } from '@/providers/I18nProvider';

function MyComponent() {
  const { t } = useI18nContext();

  return <div>{t('modpacks.install')}</div>;
}
```

### Traducciones con parámetros

```tsx
const { t } = useI18n();

// En el archivo YML:
// files.size: "Size: {{size}} {{unit}}"

const message = t('files.size', {
  size: '1.5',
  unit: t('units.megabytes')
});
// Resultado: "Size: 1.5 MB"
```

### Componente Trans

```tsx
import { Trans } from '@/providers/I18nProvider';

function MyComponent() {
  return (
    <TranslatedText
      id="files.size"
      params={{ size: '2.1', unit: 'GB' }}
    />
  );
}
```

### HOC (Higher-Order Component)

```tsx
import { withTranslation } from '@/providers/I18nProvider';

interface MyComponentProps {
  t: (key: string) => string;
  // otras props...
}

function MyComponent({ t, title }: MyComponentProps) {
  return <h1>{t('common.settings')}</h1>;
}

export default withTranslation(MyComponent);
```

## Estructura de archivos YML

Los archivos de traducción siguen esta estructura:

```yaml
# Claves anidadas
common:
  explore: "Explore"
  library: "Library"

# Con parámetros
files:
  size: "Size: {{size}} {{unit}}"

# Arrays y objetos complejos
languages:
  en: "English"
  es-419: "Spanish (Latin America)"
```

## Comandos disponibles en Rust

```rust
// Obtener idioma actual
let current_lang = invoke::<String>("get_current_language").await?;

// Cambiar idioma
invoke("set_language", { language: "es-419" }).await?;

// Obtener idiomas disponibles
let languages = invoke::<Vec<String>>("get_available_languages").await?;

// Obtener traducciones completas
let translations = invoke::<I18nData>("get_translations", {
  language: "es-419"
}).await?;

// Obtener mensaje individual
let message = invoke::<String>("get_message", {
  key: "common.explore"
}).await?;

// Mensaje con parámetros
let message = invoke::<String>("get_message_with_params", {
  key: "files.size",
  params: { size: "1.5", unit: "MB" }
}).await?;
```

## Eventos

El sistema emite eventos de Tauri cuando cambia el idioma:

```tsx
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen<I18nData>('language-changed', (event) => {
    console.log('Language changed:', event.payload.language);
  });

  return () => {
    unlisten.then(fn => fn());
  };
}, []);
```

## Integración con configuración

El idioma se guarda automáticamente en la configuración del usuario. Cuando cambias el idioma en settings, se actualiza automáticamente en toda la aplicación.

## Localazy

Para traducciones colaborativas, usa Localazy. La configuración está en `localazy.json` y las claves sensibles en `localazy.keys.json` (ignorado por git).

### Agregar un nuevo idioma

1. Crear archivo `xx.yml` en `application/src-tauri/resources/i18n/`
2. Copiar estructura del archivo `en.yml`
3. Configurar en Localazy el nuevo idioma
4. Traducir las cadenas

## Mejores prácticas

1. **Usa claves descriptivas**: `modpacks.install` en lugar de `install`
2. **Anida lógicamente**: `settings.language` en lugar de `languageSetting`
3. **Usa parámetros**: Para valores dinámicos
4. **Mantén consistencia**: Usa el mismo vocabulario en todas las traducciones
5. **Documenta**: Agrega comentarios en los archivos YML

## Optimización

- Las traducciones se cargan bajo demanda y se cachean
- Los idiomas comunes (en, es-419) se precargan al inicio
- Los cambios de idioma se propagan automáticamente a toda la app
- El sistema es eficiente y no bloquea la UI