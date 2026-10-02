package dev.alexitoo.modpackstore.agent;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

/**
 * Update orchestration: check → fetch manifest → verify/install → cleanup.
 *
 * <p>Guarantee: the server tree is only ever modified by atomic moves/copies
 * of fully hash-verified files. If anything fails, an exception propagates
 * (and {@code premain} aborts the server start) leaving the previous working
 * set intact.
 */
public final class ModpackUpdater {

    private final Config config;
    private final ApiClient api;
    private final Installer installer;

    public ModpackUpdater(Config config) {
        this.config = config;
        this.api = new ApiClient(config);
        this.installer = new Installer(config, api);
    }

    public void update() throws Exception {
        Files.createDirectories(config.storeDir());
        System.out.println("[modpack-store] Syncing modpack " + config.modpackId
                + " (wanted: " + config.version + ") into " + config.serverRoot);

        String targetVersionId;
        if ("latest".equalsIgnoreCase(config.version)) {
            String local = api.localVersion();
            Map<String, String> latest = api.checkUpdate(local);
            targetVersionId = latest.get("id");
            String latestVersion = latest.get("version");
            System.out.println("[modpack-store] Latest: " + latestVersion + " (local: " + (local == null ? "none" : local) + ")");
            if (local != null && local.equals(latestVersion)) {
                // Same version string: still re-verify local files cheaply (hash pass),
                // then stop. Any corruption is repaired without a full manifest diff.
                Manifest cached = api.fetchManifest(targetVersionId, null);
                installer.install(cached, false);
                Cleaner.cleanup(config, cached);
                System.out.println("[modpack-store] Already up to date (" + local + ").");
                return;
            }
        } else {
            targetVersionId = config.version;
        }

        Manifest manifest = api.fetchManifest(targetVersionId, null);
        if (manifest.files.isEmpty()) {
            throw new IllegalStateException("manifest contains no files; refusing to wipe managed dirs");
        }

        installer.install(manifest, false);
        Cleaner.cleanup(config, manifest);

        String versionLabel = manifest.version.isEmpty() ? targetVersionId : manifest.version;
        Path versionFile = config.storeDir().resolve("version");
        Path tmp = versionFile.resolveSibling("version.tmp");
        Files.write(tmp, (versionLabel + "\n").getBytes(StandardCharsets.UTF_8));
        try {
            Files.move(tmp, versionFile,
                    java.nio.file.StandardCopyOption.ATOMIC_MOVE,
                    java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception atomicFail) {
            Files.move(tmp, versionFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        System.out.println("[modpack-store] Modpack is now at version " + versionLabel + ". Starting server...");
    }
}
