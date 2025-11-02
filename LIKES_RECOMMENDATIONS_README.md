# Sistema de Likes/Dislikes y Recomendaciones

Este documento describe la implementación del sistema de votación (Likes/Dislikes) y el motor de recomendaciones basado en User-Based Collaborative Filtering (UBCF) con K-Nearest Neighbors (KNN).

## 📋 Descripción General

El sistema permite a los usuarios votar en modpacks y recibir recomendaciones personalizadas basadas en sus preferencias y las de usuarios similares.

### Componentes Principales

1. **Sistema de Votación (Like/Dislike)**
2. **Motor de Recomendación UBCF**
3. **API Endpoints**
4. **Componentes de UI**

## 🗄️ Base de Datos

### Tablas Nuevas

#### `modpack_votes`
Almacena los votos de los usuarios en los modpacks.

```sql
- userId: UUID (FK -> users.id)
- modpackId: UUID (FK -> modpacks.id)
- vote: SMALLINT (1 = like, -1 = dislike)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
- UNIQUE(userId, modpackId)
```

#### `user_recommendations`
Almacena las recomendaciones pre-calculadas para cada usuario.

```sql
- userId: UUID (FK -> users.id)
- modpackId: UUID (FK -> modpacks.id)
- score: FLOAT (puntuación de recomendación)
- algorithm: VARCHAR (ubcf, popular, new)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
- PRIMARY KEY(userId, modpackId)
```

## 🔌 API Endpoints

### Votación

#### POST `/api/v1/votes/modpacks/:modpackId/vote`
Permite votar en un modpack.

**Autenticación:** Requerida

**Body:**
```json
{
  "vote": "like" | "dislike" | "none"
}
```

**Respuesta:**
```json
{
  "success": true,
  "vote": "like",
  "counts": {
    "likes": 42,
    "dislikes": 5
  }
}
```

#### GET `/api/v1/votes/modpacks/:modpackId/votes`
Obtiene los conteos de votos de un modpack.

**Respuesta:**
```json
{
  "modpackId": "uuid",
  "likes": 42,
  "dislikes": 5,
  "total": 47
}
```

#### GET `/api/v1/votes/user/votes`
Obtiene todos los votos del usuario autenticado.

**Autenticación:** Requerida

**Respuesta:**
```json
{
  "votes": {
    "modpack-uuid-1": "like",
    "modpack-uuid-2": "dislike"
  }
}
```

### Recomendaciones

#### GET `/api/v1/recommendations/for-you?limit=10`
Obtiene recomendaciones personalizadas para el usuario autenticado.

**Autenticación:** Requerida

**Respuesta:**
```json
{
  "data": [...],  // Array de modpacks en formato JSON:API
  "meta": {
    "isFallback": false,
    "algorithm": "ubcf",
    "count": 10
  }
}
```

#### GET `/api/v1/recommendations/related-to/:modpackId?limit=10`
Obtiene modpacks relacionados (usuarios que les gustó este también disfrutaron de...).

**Respuesta:**
```json
{
  "data": [...],  // Array de modpacks en formato JSON:API
  "meta": {
    "count": 10,
    "basedOn": "modpack-uuid"
  }
}
```

#### POST `/api/v1/recommendations/generate`
Inicia la generación de recomendaciones para todos los usuarios (solo admins).

**Autenticación:** Requerida (Admin)

**Respuesta:**
```json
{
  "success": true,
  "message": "Recommendation generation started in background."
}
```

## 🧮 Algoritmo de Recomendación

### User-Based Collaborative Filtering (UBCF)

El sistema utiliza UBCF con K-Nearest Neighbors para generar recomendaciones:

1. **Construcción de Matriz Usuario-Item**
   - Filas: Usuarios
   - Columnas: Modpacks
   - Valores: 1 (like), -1 (dislike), 0 (sin voto)

2. **Cálculo de Similitud**
   - Métrica: Similitud Coseno
   - Mínimo de votos comunes: 3
   - Fórmula: `cos(θ) = (A · B) / (||A|| × ||B||)`

3. **Selección de Vecinos**
   - K = 10 usuarios más similares
   - Solo usuarios con similitud > 0

4. **Generación de Recomendaciones**
   - Identifica modpacks que los vecinos votaron positivamente
   - Excluye modpacks que el usuario ya votó
   - Calcula puntuación normalizada
   - Ordena por puntuación descendente
   - Retorna top 20

### Estrategia de Cold Start

Cuando un usuario es nuevo o tiene pocos votos:

1. **Fallback a Populares**: Modpacks con más likes
2. **Fallback a Nuevos**: Modpacks publicados recientemente

## 🔄 Trabajo en Segundo Plano

### Generación de Recomendaciones

Las recomendaciones se calculan en segundo plano mediante:

**Comando Manual:**
```bash
npm run job:generate-recommendations
```

**Ubicación del Script:**
```
backend/src/jobs/generate-recommendations.ts
```

**Proceso:**
1. Conecta a la base de datos
2. Construye la matriz usuario-item
3. Calcula similitud para cada usuario
4. Genera recomendaciones
5. Almacena en tabla `user_recommendations`
6. Cierra conexión

**Recomendación:** Programar este job para ejecutarse periódicamente (ej: cron job cada 24 horas).

## 🎨 Componentes de UI

### VoteButtons

Botones de votación con actualización optimista.

**Ubicación:** `application/src/components/modpack/VoteButtons.tsx`

**Props:**
```typescript
interface VoteButtonsProps {
    modpackId: string;
    initialVote?: VoteType;
    initialCounts?: { likes: number; dislikes: number };
    onVoteChange?: (vote: VoteType, counts: { likes: number; dislikes: number }) => void;
    className?: string;
    showCounts?: boolean;
}
```

**Características:**
- Actualización optimista de UI
- Manejo de errores con rollback
- Animaciones de transición
- Indicador de estado de carga

### RecommendedModpacks

Componente para mostrar recomendaciones personalizadas en la página de inicio.

**Ubicación:** `application/src/components/modpack/RecommendedModpacks.tsx`

**Props:**
```typescript
interface RecommendedModpacksProps {
    userId?: string;
    limit?: number;
    className?: string;
    title?: string;
    showFallbackLabel?: boolean;
}
```

**Características:**
- Detección automática de fallback
- Estados de carga
- Títulos dinámicos según algoritmo

### RelatedModpacks

Componente para mostrar modpacks relacionados en la vista de detalle.

**Ubicación:** `application/src/components/modpack/RelatedModpacks.tsx`

**Props:**
```typescript
interface RelatedModpacksProps {
    modpackId: string;
    limit?: number;
    className?: string;
}
```

## 🚀 Integración

### ModpackOverview

La página de detalle de modpack ahora incluye:

1. **Botones de Votación**: Debajo del botón de instalación
2. **Pestaña "Recomendados"**: Muestra modpacks relacionados

### ExploreSection

La página de inicio ahora incluye:

1. **Sección de Recomendaciones**: Solo para usuarios autenticados
2. **Título Dinámico**: Cambia según el algoritmo usado
3. **Posición**: Antes de las categorías

## 🔒 Seguridad

### Validaciones Implementadas

1. **Autenticación**: Todos los endpoints de votación requieren autenticación
2. **Autorización**: Solo admins pueden disparar generación de recomendaciones
3. **Validación de Entrada**: Validación de tipo de voto (like/dislike/none)
4. **Prevención de Abuso**: Constraint único (userId, modpackId)
5. **SQL Injection**: Uso de TypeORM previene inyecciones SQL

### Escaneo de Seguridad

✅ **CodeQL**: 0 vulnerabilidades detectadas

## 📊 Consideraciones de Rendimiento

### Optimizaciones

1. **Pre-cálculo**: Recomendaciones generadas en background
2. **Indexación**: Índices en tablas de votos y recomendaciones
3. **Límites**: Límite de resultados en consultas
4. **Cache**: Recomendaciones almacenadas en BD

### Escalabilidad

Para bases de datos grandes:

1. Ejecutar generación de recomendaciones en horarios de baja actividad
2. Considerar particionamiento de tablas
3. Implementar sistema de cache (Redis) para accesos frecuentes
4. Procesar usuarios en lotes más pequeños

## 🧪 Pruebas Sugeridas

### Backend

```bash
# Votar en un modpack
curl -X POST http://localhost:3000/api/v1/votes/modpacks/{id}/vote \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"vote":"like"}'

# Obtener recomendaciones
curl http://localhost:3000/api/v1/recommendations/for-you?limit=10 \
  -H "Authorization: Bearer {token}"

# Generar recomendaciones (admin)
curl -X POST http://localhost:3000/api/v1/recommendations/generate \
  -H "Authorization: Bearer {admin-token}"
```

### Frontend

1. Navegar a la página de un modpack
2. Hacer clic en Like/Dislike
3. Verificar actualización optimista
4. Recargar página y verificar persistencia
5. Ver recomendaciones en página de inicio
6. Navegar a pestaña "Recomendados" en detalle de modpack

## 📝 Notas de Implementación

- TypeScript 4.9 usado para compatibilidad
- Decoradores experimentales habilitados en tsconfig
- Path aliases configurados (@/ apunta a src/)
- TypeORM con sincronización automática habilitada (desarrollo)

## 🔮 Mejoras Futuras

1. **Item-Based CF**: Implementar recomendaciones basadas en items
2. **Hybrid System**: Combinar UBCF con content-based filtering
3. **Real-time Updates**: WebSockets para actualizar votos en tiempo real
4. **Analytics**: Dashboard de métricas de votación y recomendaciones
5. **A/B Testing**: Experimentar con diferentes algoritmos
6. **Machine Learning**: Implementar modelos de ML más avanzados
