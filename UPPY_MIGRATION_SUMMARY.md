# Migración a Uppy - Sistema de Subida de Archivos

## 📋 Resumen

Se ha completado con éxito la migración del sistema de subida de archivos de XMLHttpRequest nativo a **Uppy**, manteniendo todo el diseño, layout y experiencia visual existentes.

## ✅ Cambios Implementados

### 1. Dependencias Instaladas
```json
{
  "@uppy/core": "5.1.0",
  "@uppy/xhr-upload": "5.0.1"
}
```

### 2. Nuevos Archivos Creados

#### `application/src/hooks/useUppyUpload.ts`
Hook personalizado que envuelve la funcionalidad de Uppy para integraciones reutilizables.

**Características:**
- Manejo automático del ciclo de vida de Uppy
- Eventos mapeados: `upload-progress`, `upload-success`, `upload-error`, `complete`
- Configuración dinámica de endpoint y headers
- Soporte para validaciones de tipo y tamaño de archivo
- Gestión de estado de carga y progreso

**Uso:**
```typescript
const uppyUpload = useUppyUpload({
    endpoint: '/api/upload',
    headers: { 'Authorization': 'Bearer token' },
    fieldName: 'file',
    formData: { key: 'value' },
    onProgress: (progress) => console.log(progress),
    onSuccess: (response) => console.log('Éxito!'),
    onError: (error) => console.error(error),
});
```

#### `application/src/utils/uppyUpload.ts`
Utilidad standalone para subidas únicas sin necesidad de hooks.

**Características:**
- Función async/await simple para subidas one-off
- Gestión automática del ciclo de vida de Uppy
- Callbacks para progreso, éxito y error

**Uso:**
```typescript
await uploadFileWithUppy({
    file,
    endpoint: '/api/upload',
    headers: { 'Authorization': 'Bearer token' },
    fieldName: 'file',
    formData: { key: 'value' },
    onProgress: (progress) => setProgress(progress),
    onSuccess: (response) => toast.success('Éxito!'),
    onError: (error) => toast.error(error.message),
});
```

### 3. Archivos Actualizados

#### `application/src/hooks/useFileUpload.ts`
- Añadido soporte opcional para Uppy
- Mantiene backward compatibility
- Nuevas opciones: `endpoint`, `headers`, `fieldName`, `formData`
- Nuevo método `upload()` para iniciar subidas con Uppy

#### `application/src/components/creator/dialogs/ImportCurseForgeDialog.tsx`
- Migrado de XMLHttpRequest a `uploadFileWithUppy`
- Mantiene todos los estados y mensajes de progreso existentes
- Mantiene manejo de errores y éxitos

#### `application/src/views/creator/ModpackVersionDetailView.tsx`
- Migrado handleFileUpload a usar `uploadFileWithUppy`
- Preserva validación de archivos ZIP
- Mantiene barra de progreso y mensajes de estado

#### `application/src/views/publisher/PublisherModpackVersionDetailView.tsx`
- Migrado handleFileUpload a usar `uploadFileWithUppy`
- Funcionalidad idéntica a la versión creator
- UI sin cambios

## 🎯 Objetivos Cumplidos

### ✅ Mantener UI Personalizada
- No se utiliza el Dashboard de Uppy
- Todos los componentes visuales permanecen iguales:
  - Botones de selección de archivo
  - Drag & drop zones
  - Barras de progreso
  - Mensajes de error y éxito
  - Estilos y layout

### ✅ Funcionalidad Preservada
- Validaciones de tipo de archivo (ZIP, imágenes, etc.)
- Validaciones de tamaño máximo
- Progreso de subida en tiempo real
- Manejo de errores robusto
- Callbacks de éxito/error
- Integración con sistema de toast (Sonner)

### ✅ Mejoras de Estabilidad
- Uppy proporciona mejor manejo de errores
- Gestión automática de reintentos (configurable)
- Cancelación de subidas más robusta
- Mejor gestión de memoria

## 🔧 Configuración y Extensiones Futuras

### Reintentos Automáticos
```typescript
uppy.use(XHRUpload, {
    endpoint: '/api/upload',
    // ... otras opciones
    limit: 3, // número de subidas concurrentes
    timeout: 30000, // timeout en ms
    // Uppy maneja reintentos automáticamente en errores de red
});
```

### Upload por Chunks (para archivos grandes)
```typescript
// Futuro: reemplazar XHRUpload con AwsS3Multipart o Tus
import AwsS3Multipart from '@uppy/aws-s3-multipart';

uppy.use(AwsS3Multipart, {
    companionUrl: '/api/companion',
    // configuración de chunks
});
```

### Compresión de Archivos
```typescript
import Compressor from '@uppy/compressor';

uppy.use(Compressor, {
    quality: 0.6,
    maxWidth: 2000,
    maxHeight: 2000,
});
```

### Validaciones Adicionales
```typescript
const uppy = new Uppy({
    restrictions: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        maxNumberOfFiles: 1,
        minNumberOfFiles: 1,
        allowedFileTypes: ['.zip', '.jar'],
    },
    onBeforeFileAdded: (currentFile, files) => {
        // validación personalizada
        return true;
    },
});
```

## 🧪 Testing

### Build
```bash
cd application
pnpm build
```
**Estado:** ✅ Build exitoso sin errores

### Áreas a Probar Manualmente
1. **ImportCurseForgeDialog**
   - Importar modpack desde archivo ZIP
   - Verificar progreso de subida
   - Verificar manejo de errores

2. **ModpackVersionDetailView** 
   - Subir archivos de tipo client/server/overrides
   - Validación de archivos ZIP
   - Progreso y mensajes de estado

3. **PublisherModpackVersionDetailView**
   - Similar a ModpackVersionDetailView
   - Permisos de publisher

## 📊 Comparativa Antes/Después

### Antes (XMLHttpRequest)
```typescript
const xhr = new XMLHttpRequest();
xhr.upload.addEventListener('progress', (event) => {
    const progress = (event.loaded / event.total) * 100;
    setProgress(progress);
});
xhr.addEventListener('load', () => {
    if (xhr.status === 200) {
        // manejar éxito
    } else {
        // manejar error
    }
});
xhr.open('POST', endpoint);
xhr.send(formData);
```

### Después (Uppy)
```typescript
await uploadFileWithUppy({
    file,
    endpoint,
    onProgress: (progress) => setProgress(progress),
    onSuccess: (response) => handleSuccess(response),
    onError: (error) => handleError(error),
});
```

## 🎨 Sin Cambios en UI/UX

- ✅ Mismo diseño visual
- ✅ Mismos botones e interacciones
- ✅ Mismas barras de progreso
- ✅ Mismos mensajes de error/éxito
- ✅ Mismo flujo de usuario
- ✅ Drag & drop preservado (donde existía)

## 📝 Notas Importantes

1. **No se usa Dashboard de Uppy**: La UI es completamente custom
2. **Backward Compatible**: El hook `useFileUpload` sigue funcionando sin Uppy si no se proporciona `endpoint`
3. **FormData**: Uppy maneja automáticamente la construcción de FormData
4. **Headers**: Se pueden pasar headers dinámicamente (ej: Authorization tokens)
5. **Eventos**: Todos los eventos están mapeados a callbacks familiares

## 🚀 Próximos Pasos Sugeridos

1. **Testing Manual**: Probar todos los flujos de subida
2. **Monitoreo**: Verificar logs de errores en producción
3. **Performance**: Monitorear tiempos de subida
4. **Extensiones**: Considerar implementar:
   - Upload por chunks para archivos muy grandes
   - Compresión de imágenes
   - Reintentos configurables
   - Upload concurrente de múltiples archivos

## 🔗 Recursos

- [Uppy Documentation](https://uppy.io/docs/)
- [XHR Upload Plugin](https://uppy.io/docs/xhr-upload/)
- [Uppy Core Options](https://uppy.io/docs/uppy/)
