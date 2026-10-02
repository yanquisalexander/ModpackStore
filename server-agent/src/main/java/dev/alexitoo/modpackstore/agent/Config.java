package dev.alexitoo.modpackstore.agent;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

/**
 * Agent configuration.
 *
 * <p>Resolution order (first win): {@code premain} args / CLI flags, then
 * {@code .modpack-store/config.json} in the server root, then environment.
 *
 * <p>Agent args format (comma separated): {@code key=value,key=value}
 * <pre>
 * -javaagent:modpack-store-agent.jar=modpack=abc123,version=latest
 * </pre>
 * CLI flags: {@code --key value}. Env: {@code MODPACK_TOKEN}, {@code MODPACK_ID},
 * {@code MODPACK_VERSION}, {@code MODPACK_API}, {@code MODPACK_CDN}.
 */
public final class Config {

    final String apiBase;
    final String cdnBase;
    final String modpackId;
    final String version;
    final String token;
    final Path serverRoot;

    Config(String apiBase, String cdnBase, String modpackId, String version, String token, Path serverRoot) {
        this.apiBase = apiBase;
        this.cdnBase = cdnBase;
        this.modpackId = modpackId;
        this.version = version;
        this.token = token;
        this.serverRoot = serverRoot;
    }

    static Config resolve(String agentArgs) throws Exception {
        Map<String, String> args = parseArgs(agentArgs);
        Path serverRoot = Paths.get(args.getOrDefault("server-root",
                System.getProperty("modpack.serverRoot", System.getProperty("user.dir", ".")))).toAbsolutePath().normalize();

        Map<String, String> file = readConfigFile(serverRoot);

        String apiBase = first(args.get("api"), file.get("apiBase"), env("MODPACK_API"), "https://modpackstore-api.alexitoo.deno.net/v1");
        // Same default as the desktop client (src-tauri main.rs CDN_URL): relative
        // manifest downloadUrls ("/resources/files/...") live on the CDN, not the API.
        String cdnBase = first(args.get("cdn"), file.get("cdnBase"), env("MODPACK_CDN"), "https://cdn-mstore.saltouruguayserver.com");
        String modpackId = first(args.get("modpack"), file.get("modpackId"), env("MODPACK_ID"), null);
        String version = first(args.get("version"), file.get("version"), env("MODPACK_VERSION"), "latest");
        String token = first(args.get("token"), file.get("token"), env("MODPACK_TOKEN"), null);

        if (modpackId == null || modpackId.isEmpty()) {
            throw new IllegalArgumentException("Missing modpack id (agent arg modpack=, .modpack-store/config.json, or MODPACK_ID)");
        }
        if (token == null || token.isEmpty()) {
            throw new IllegalArgumentException("Missing API token (agent arg token=, config file, or MODPACK_TOKEN). Create one in the creator dashboard → API Tokens.");
        }
        return new Config(stripTrailingSlash(apiBase), stripTrailingSlash(cdnBase), modpackId, version, token, serverRoot);
    }

    Path storeDir() {
        return serverRoot.resolve(".modpack-store");
    }

    private static String first(String... candidates) {
        for (String c : candidates) {
            if (c != null && !c.isEmpty()) {
                return c;
            }
        }
        return null;
    }

    private static String env(String name) {
        try {
            return System.getenv(name);
        } catch (SecurityException e) {
            return null;
        }
    }

    private static String stripTrailingSlash(String url) {
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }

    /** Parses {@code k=v,k=v} (premain) and {@code --k v} lines (CLI) into one map. */
    static Map<String, String> parseArgs(String agentArgs) {
        Map<String, String> map = new HashMap<>();
        if (agentArgs == null || agentArgs.trim().isEmpty()) {
            return map;
        }
        // CLI style: lines of "--key value"
        String[] lines = agentArgs.split("[\n]+");
        String pendingKey = null;
        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty()) {
                continue;
            }
            if (line.startsWith("--")) {
                if (pendingKey != null) {
                    map.put(pendingKey, "");
                }
                String stripped = line.substring(2);
                int eq = stripped.indexOf('=');
                int sp = stripped.indexOf(' ');
                if (eq >= 0) {
                    map.put(stripped.substring(0, eq).trim(), stripped.substring(eq + 1).trim());
                    pendingKey = null;
                } else if (sp >= 0) {
                    map.put(stripped.substring(0, sp).trim(), stripped.substring(sp + 1).trim());
                    pendingKey = null;
                } else {
                    pendingKey = stripped;
                }
            } else if (pendingKey != null) {
                map.put(pendingKey, line);
                pendingKey = null;
            } else {
                // premain style: k=v,k=v
                for (String part : line.split(",")) {
                    int eq = part.indexOf('=');
                    if (eq > 0) {
                        map.put(part.substring(0, eq).trim(), part.substring(eq + 1).trim());
                    }
                }
            }
        }
        if (pendingKey != null) {
            map.put(pendingKey, "");
        }
        return map;
    }

    /** Minimal flat-JSON reader (no dependencies): only string top-level values. */
    static Map<String, String> readConfigFile(Path serverRoot) {
        Map<String, String> map = new HashMap<>();
        try {
            Path cfg = serverRoot.resolve(".modpack-store").resolve("config.json");
            if (!Files.isRegularFile(cfg)) {
                return map;
            }
            String json = new String(Files.readAllBytes(cfg), "UTF-8");
            map.putAll(Json.parseFlatStringObject(json));
        } catch (Exception e) {
            System.err.println("[modpack-store] WARN: could not read .modpack-store/config.json: " + e.getMessage());
        }
        return map;
    }
}
