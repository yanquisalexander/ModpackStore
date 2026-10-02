package dev.alexitoo.modpackstore.agent;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.Map;

/**
 * Minimal backend client (JDK {@code java.net.http} only).
 *
 * <p>Endpoints used (all accept {@code Authorization: Bearer mps_...} with the
 * {@code server:sync} scope):
 * <ul>
 *   <li>{@code GET /explore/modpacks/:id/check-update?currentVersion=X}</li>
 *   <li>{@code GET /explore/modpacks/:id/latest}</li>
 *   <li>{@code GET /explore/modpacks/:id/versions/:v?target=server} (ETag cached)</li>
 * </ul>
 */
final class ApiClient {

    private final Config config;
    private final HttpClient http;

    ApiClient(Config config) {
        this.config = config;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /** Returns the installed version string recorded locally, or {@code null}. */
    String localVersion() {
        try {
            Path versionFile = config.storeDir().resolve("version");
            if (Files.isRegularFile(versionFile)) {
                String v = new String(Files.readAllBytes(versionFile), StandardCharsets.UTF_8).trim();
                return v.isEmpty() ? null : v;
            }
        } catch (Exception e) {
            System.err.println("[modpack-store] WARN: could not read local version: " + e.getMessage());
        }
        return null;
    }

    /** Calls {@code check-update}. Returns latest version id + version string. */
    Map<String, String> checkUpdate(String currentVersion) throws Exception {
        String url = config.apiBase + "/explore/modpacks/" + encode(config.modpackId)
                + "/check-update?currentVersion=" + encode(currentVersion == null ? "none" : currentVersion);
        String body = get(url, null);
        // Response: {"hasUpdate":bool,"currentVersion":...,"latestVersion":{"id","version",...},...}
        Map<String, String> latest = Json.parseLatestVersion(body);
        if (latest.get("id") == null) {
            throw new IllegalStateException("check-update returned no latestVersion (body=" + truncate(body) + ")");
        }
        return latest;
    }

    /**
     * Fetches the server manifest for a version id (or {@code "latest"}).
     * Uses the cached ETag: on 304 the last stored manifest body is reused.
     */
    Manifest fetchManifest(String versionIdOrLatest, String[] etagHolder) throws Exception {
        String url = config.apiBase + "/explore/modpacks/" + encode(config.modpackId)
                + "/versions/" + encode(versionIdOrLatest) + "?target=server";
        Files.createDirectories(config.storeDir());
        Path etagFile = config.storeDir().resolve("manifest.etag");
        Path bodyFile = config.storeDir().resolve("last-manifest.json");
        String cachedEtag = null;
        try {
            if (Files.isRegularFile(etagFile)) {
                cachedEtag = new String(Files.readAllBytes(etagFile), StandardCharsets.UTF_8).trim();
            }
        } catch (Exception ignored) {
        }
        HttpResult result = getRaw(url, cachedEtag);
        if (result.status == 304) {
            if (Files.isRegularFile(bodyFile)) {
                System.out.println("[modpack-store] Manifest unchanged (ETag match).");
                String cached = new String(Files.readAllBytes(bodyFile), StandardCharsets.UTF_8);
                return Json.parseManifest(cached);
            }
            // Cache lost: retry unconditionally.
            result = getRaw(url, null);
        }
        if (result.status != 200) {
            throw new IllegalStateException("manifest request failed: HTTP " + result.status + " (" + truncate(result.body) + ")");
        }
        if (result.etag != null && !result.etag.isEmpty()) {
            try {
                Files.write(etagFile, result.etag.getBytes(StandardCharsets.UTF_8));
                if (etagHolder != null && etagHolder.length > 0) {
                    etagHolder[0] = result.etag;
                }
            } catch (Exception ignored) {
            }
        }
        try {
            Files.write(bodyFile, result.body.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) {
        }
        return Json.parseManifest(result.body);
    }

    /** Downloads a URL to a temp file then atomically moves it to {@code dest}. */
    void downloadToFile(String url, Path dest, long expectedSize) throws Exception {
        String absolute = absoluteUrl(url);
        HttpRequest request = HttpRequest.newBuilder(URI.create(absolute))
                .timeout(Duration.ofMinutes(10))
                .header("Authorization", "Bearer " + config.token)
                .GET()
                .build();
        HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() != 200) {
            throw new IllegalStateException("download failed (" + response.statusCode() + "): " + absolute);
        }
        Path tmp = dest.resolveSibling(dest.getFileName() + ".part");
        Files.createDirectories(dest.getParent());
        try (InputStream in = response.body();
             OutputStream out = Files.newOutputStream(tmp)) {
            byte[] buf = new byte[65536];
            long total = 0;
            int read;
            while ((read = in.read(buf)) >= 0) {
                out.write(buf, 0, read);
                total += read;
            }
            if (expectedSize >= 0 && total != expectedSize) {
                throw new IllegalStateException("size mismatch for " + dest.getFileName()
                        + ": expected " + expectedSize + " bytes, got " + total);
            }
        } catch (Exception e) {
            try {
                Files.deleteIfExists(tmp);
            } catch (Exception ignored) {
            }
            throw e;
        }
        try {
            Files.move(tmp, dest, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception atomicFail) {
            Files.move(tmp, dest, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private String get(String url, String ifNoneMatch) throws Exception {
        HttpResult r = getRaw(url, ifNoneMatch);
        if (r.status == 304) {
            return "";
        }
        if (r.status == 401 || r.status == 403) {
            throw new IllegalStateException("backend rejected the API token (HTTP " + r.status + "). "
                    + "Check the token is valid, has the server:sync scope, and covers this modpack.");
        }
        if (r.status != 200) {
            throw new IllegalStateException("request failed: HTTP " + r.status + " (" + truncate(r.body) + ")");
        }
        return r.body;
    }

    private HttpResult getRaw(String url, String ifNoneMatch) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + config.token)
                .header("Accept", "application/json")
                .GET();
        if (ifNoneMatch != null && !ifNoneMatch.isEmpty()) {
            builder.header("If-None-Match", ifNoneMatch);
        }
        HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        String etag = response.headers().firstValue("ETag").orElse(null);
        return new HttpResult(response.statusCode(), response.body(), etag);
    }

    /**
     * Manifest entries carry either absolute URLs or backend-relative paths
     * ({@code /resources/files/...}). Relative ones live on the CDN
     * (same rule as the desktop client: {@code CDN_URL + downloadUrl}).
     */
    private String absoluteUrl(String url) {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            return url;
        }
        if (!url.startsWith("/")) {
            url = "/" + url;
        }
        return config.cdnBase + url;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String truncate(String s) {
        if (s == null) {
            return "";
        }
        return s.length() > 300 ? s.substring(0, 300) + "..." : s;
    }

    private static final class HttpResult {
        final int status;
        final String body;
        final String etag;

        HttpResult(int status, String body, String etag) {
            this.status = status;
            this.body = body;
            this.etag = etag;
        }
    }
}
