FROM denoland/deno:latest

WORKDIR /app

COPY deno.jsonc deno.lock ./
RUN deno cache src/index.ts

COPY . .
RUN chmod +x docker-entrypoint.sh

CMD ["./docker-entrypoint.sh"]
