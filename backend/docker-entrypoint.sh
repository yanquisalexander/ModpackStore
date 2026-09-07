#!/bin/sh
set -e

# 1. Configuración de Memoria Dinámica (Low Mode por defecto)
# Si no defines V8_MAX_MEMORY en tu .env o panel de Render, usará 256MB por defecto.
# Si en el futuro subes a un plan de pago con 1GB, solo cambias la variable sin tocar código.
MAX_RAM=${V8_MAX_MEMORY:-256}

# 2. Flags Base Consolidados
# Agregamos --allow-sys a todos porque tu status page hace Deno.systemMemoryInfo()
# Agregamos --no-prompt para evitar que la app se quede colgada esperando input manual si falta un permiso
DENO_FLAGS="--allow-net --allow-read --allow-env --allow-write --allow-ffi --allow-sys --no-prompt"

# 3. Flags de V8 (Motor de JS)
V8_FLAGS="--v8-flags=--max-old-space-size=${MAX_RAM}"

echo "[STARTUP] Starting Deno process (V8 Max RAM: ${MAX_RAM}MB)..."

if [ "$WORKER_MODE" = "1" ]; then
    echo "[STARTUP] Mode: WORKER"
    # 'exec' pasa el control maestro a Deno para que intercepte SIGINT/SIGTERM
    exec deno run $DENO_FLAGS $V8_FLAGS src/index.ts --worker-mode
else
    echo "[STARTUP] Mode: SERVER"
    exec deno run $DENO_FLAGS $V8_FLAGS src/index.ts
fi