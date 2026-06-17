#!/bin/sh
set -e

DENO_FLAGS="--allow-net --allow-read --allow-env --allow-write --allow-ffi"

if [ "$WORKER_MODE" = "1" ]; then
    exec deno run $DENO_FLAGS --allow-sys src/index.ts --worker-mode
else
    exec deno run $DENO_FLAGS src/index.ts
fi
