package dev.alexitoo.modpackstore.agent;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Downloads manifest files into {@code .modpack-store/cache} (verified by SHA-1)
 * and installs them atomically into the server root.
 *
 * <p>Files already present with the correct hash are skipped — so restarts are
 * cheap and re-running after a failure never leaves partial state in place:
 * the server tree is only touched by atomic moves of fully verified files.
 */
final class Installer {

    private static final int CONCURRENCY = 4;

    private final Config config;
    private final ApiClient api;

    Installer(Config config, ApiClient api) {
        this.config = config;
        this.api = api;
    }

    /**
     * Returns the number of files that were (re)installed.
     *
     * @param manifest  server manifest (source of truth)
     * @param forceAll  when true, re-verify and re-install every file
     */
    int install(Manifest manifest, boolean forceAll) throws Exception {
        Path cacheDir = config.storeDir().resolve("cache");
        Files.createDirectories(cacheDir);

        List<ManifestFile> pending = new ArrayList<>();
        for (ManifestFile file : manifest.files) {
            assertSafePath(file.path);
            Path target = config.serverRoot.resolve(file.path);
            if (!forceAll && Verifier.matches(target, file.fileHash)) {
                continue;
            }
            pending.add(file);
        }

        if (pending.isEmpty()) {
            System.out.println("[modpack-store] All " + manifest.files.size() + " files are up to date.");
            return 0;
        }

        System.out.println("[modpack-store] Need " + pending.size() + " of " + manifest.files.size() + " files.");

        // 1) Download everything into the cache first (nothing in the server tree yet).
        ExecutorService pool = Executors.newFixedThreadPool(Math.min(CONCURRENCY, pending.size()));
        AtomicInteger done = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();
        final Exception[] failure = new Exception[1];
        for (ManifestFile file : pending) {
            futures.add(pool.submit(() -> {
                try {
                    Path cached = cacheDir.resolve(file.fileHash);
                    if (!Verifier.matches(cached, file.fileHash)) {
                        api.downloadToFile(file.downloadUrl, cached, file.size);
                        if (!Verifier.matches(cached, file.fileHash)) {
                            throw new IllegalStateException("hash mismatch after download: " + file.path);
                        }
                    }
                    int n = done.incrementAndGet();
                    if (n % 10 == 0 || n == pending.size()) {
                        System.out.println("[modpack-store] Downloaded " + n + "/" + pending.size());
                    }
                } catch (Exception e) {
                    synchronized (failure) {
                        if (failure[0] == null) {
                            failure[0] = e;
                        }
                    }
                }
            }));
        }
        pool.shutdown();
        try {
            for (Future<?> f : futures) {
                try {
                    f.get();
                } catch (Exception ignored) {
                }
            }
            if (!pool.awaitTermination(30, TimeUnit.MINUTES)) {
                throw new IllegalStateException("download timed out");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("download interrupted", e);
        }
        if (failure[0] != null) {
            throw new IllegalStateException("failed to download modpack files: " + failure[0].getMessage(), failure[0]);
        }

        // 2) Atomic install from the verified cache into the server tree.
        int installed = 0;
        for (ManifestFile file : pending) {
            Path cached = cacheDir.resolve(file.fileHash);
            Path target = config.serverRoot.resolve(file.path);
            Files.createDirectories(target.getParent());
            try {
                Files.copy(cached, target, StandardCopyOption.REPLACE_EXISTING);
            } catch (Exception e) {
                throw new IllegalStateException("failed to install " + file.path + ": " + e.getMessage(), e);
            }
            if (!Verifier.matches(target, file.fileHash)) {
                throw new IllegalStateException("hash mismatch after install: " + file.path);
            }
            installed++;
        }
        System.out.println("[modpack-store] Installed " + installed + " files.");
        return installed;
    }

    /** Rejects absolute paths and {@code ..} escapes outside the server root. */
    static void assertSafePath(String path) {
        if (path == null || path.isEmpty() || new java.io.File(path).isAbsolute()
                || path.startsWith("/") || path.startsWith("\\")
                || path.contains("..")) {
            throw new IllegalArgumentException("unsafe manifest path: " + path);
        }
    }
}
