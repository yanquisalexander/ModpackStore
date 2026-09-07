#!/bin/sh
set -e

# 1. Autocálculo de RAM recomendada si no se especifica V8_MAX_MEMORY
if [ -z "$V8_MAX_MEMORY" ]; then
    # Intentar leer el límite de memoria del contenedor cgroups v2 (común en Render/Docker)
    if [ -f /sys/fs/cgroup/memory.max ]; then
        CGROUP_MAX=$(cat /sys/fs/cgroup/memory.max)
        # Si no está en "max" (infinito)
        if [ "$CGROUP_MAX" != "max" ] && [ -n "$CGROUP_MAX" ]; then
            # Convertir bytes a MB y restar un margen de seguridad (ej. 128MB o 256MB para el SO/Node/Deno extras)
            # Usamos awk para divisiones seguras en sh puro
            CONTAINER_MB=$((CGROUP_MAX / 1024 / 1024))
            if [ "$CONTAINER_MB" -gt 512 ]; then
                # Si tiene más de 512MB, dejamos un margen de 256MB
                MAX_RAM=$((CONTAINER_MB - 256))
            elif [ "$CONTAINER_MB" -gt 256 ]; then
                # Si está en el rango de 512MB (como el plan gratis), dejamos 128MB libres para Deno/OS
                MAX_RAM=$((CONTAINER_MB - 128))
            else
                MAX_RAM=128
            fi
            echo "[STARTUP] Auto-detected container limit: ${CONTAINER_MB}MB. Setting V8 limit to: ${MAX_RAM}MB"
        fi
    fi

    # Fallback por cgroups v1 si el v2 no existe
    if [ -z "$MAX_RAM" ] && [ -f /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
        CGROUP_MAX=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)
        # Un valor absurdamente alto significa sin límite
        if [ "$CGROUP_MAX" -lt 9223372036854771707 ]; then
            CONTAINER_MB=$((CGROUP_MAX / 1024 / 1024))
            MAX_RAM=$((CONTAINER_MB - 128))
            echo "[STARTUP] Auto-detected cgroups v1 limit: ${CONTAINER_MB}MB. Setting V8 limit to: ${MAX_RAM}MB"
        fi
    fi

    # Fallback final si todo lo anterior falla (por ejemplo, corriendo local en tu PC)
    MAX_RAM=${MAX_RAM:-256}
else
    echo "[STARTUP] Using manual V8_MAX_MEMORY override: ${V8_MAX_MEMORY}MB"
    MAX_RAM=$V8_MAX_MEMORY
fi

# 2. Flags Base Consolidados
DENO_FLAGS="--allow-net --allow-read --allow-env --allow-write --allow-ffi --allow-sys --no-prompt"

# 3. Flags de V8 (Motor de JS)
V8_FLAGS="--v8-flags=--max-old-space-size=${MAX_RAM}"

echo "[STARTUP] Starting Deno process (V8 Max RAM: ${MAX_RAM}MB)..."

if [ "$WORKER_MODE" = "1" ]; then
    echo "[STARTUP] Mode: WORKER"
    exec deno run $DENO_FLAGS $V8_FLAGS src/index.ts --worker-mode
else
    echo "[STARTUP] Mode: SERVER"
    exec deno run $DENO_FLAGS $V8_FLAGS src/index.ts
fi