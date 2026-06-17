FROM denoland/deno:alpine-2.2

WORKDIR /app

COPY deno.jsonc deno.lock ./
RUN deno cache src/index.ts

COPY . .
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
