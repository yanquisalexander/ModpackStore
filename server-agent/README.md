# Modpack Store Server Agent

Java agent that syncs a modpack from Modpack Store **before** a Minecraft
server boots. Runs on `premain`, so the update happens before
`MinecraftServer.main()`.

```bash
java -javaagent:modpack-store-agent.jar=modpack=<id> -jar server.jar nogui
```

If the update succeeds → the server starts. If it fails → the JVM exits
with code 1 and the server never starts half-updated.

Coexists with other agents (e.g. authlib): just stack `-javaagent` flags.

## Configuration

Resolution order: agent args → `.modpack-store/config.json` → environment.

| Key | Agent arg | Env | Default |
|---|---|---|---|
| Modpack id | `modpack=` | `MODPACK_ID` | — (required) |
| Version | `version=` | `MODPACK_VERSION` | `latest` |
| API base | `api=` | `MODPACK_API` | `https://modpackstore-api.alexitoo.deno.net/v1` |
| Token | `token=` | `MODPACK_TOKEN` | — (required) |
| CDN base | `cdn=` | `MODPACK_CDN` | `https://cdn-mstore.saltouruguayserver.com` |
| Server root | `server-root=` | — (cwd) | working directory |

Create the token in the creator dashboard → **API Tokens** (scope
`server:sync`). Prefer `MODPACK_TOKEN` over `token=` so the secret never
shows up in process lists:

```bash
export MODPACK_TOKEN="mps_..."
java -javaagent:modpack-store-agent.jar=modpack=<id> -jar server.jar nogui
```

Or `server/.modpack-store/config.json`:

```json
{
  "apiBase": "https://modpackstore-api.alexitoo.deno.net/v1",
  "modpackId": "<id>",
  "version": "latest",
  "token": "mps_..."
}
```

Sidecar mode (no JVM flags, e.g. `start.sh` runs update first):

```bash
java -jar modpack-store-agent.jar --modpack <id> [--version latest] [--api https://...] [--server-root .]
```

## How it works

1. `GET .../check-update?currentVersion=X` (skipped when a version is pinned).
2. `GET .../versions/<id>?target=server` with ETag caching.
3. Files missing or with wrong SHA-1 are downloaded to
   `.modpack-store/cache/<sha1>`, verified, then installed atomically.
   Files already correct are skipped (hashes are SHA-1, same as the backend).
4. Obsolete files are removed **only** inside managed dirs
   (`mods`, `config`, `defaultconfigs`, `kubejs`, …). `world*/`,
   `server.properties`, `whitelist.json`, `ops.json`, ban lists, `logs/`,
   `server.jar` and `.modpack-store/` are never touched.
5. On success, `.modpack-store/version` is updated.

## Build

No Maven needed (zero dependencies, JDK 17+):

- Windows: `.\build.ps1`
- Linux: `./build.sh`

Output: `target/modpack-store-agent.jar` (self tests run first).
With Maven: `mvn package`.
