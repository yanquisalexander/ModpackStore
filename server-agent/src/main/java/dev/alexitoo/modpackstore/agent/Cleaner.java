package dev.alexitoo.modpackstore.agent;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Removes files that are no longer part of the manifest — but ONLY inside
 * managed directories, and NEVER touching server-critical files.
 *
 * <p>This is intentionally less aggressive than the desktop client cleanup:
 * a server owns precious state ({@code world/}, {@code server.properties},
 * allow/deny lists...) that no modpack update may ever delete.
 */
final class Cleaner {

    /** Top-level directories the modpack is allowed to manage. */
    private static final Set<String> MANAGED_DIRS = new HashSet<>(Arrays.asList(
            "mods", "config", "defaultconfigs", "kubejs", "scripts", "data",
            "datapacks", "resourcepacks", "shaderpacks", "plugins", "libraries-client"
    ));

    /** Exact file names (anywhere) that must never be removed. */
    private static final Set<String> PROTECTED_FILES = new HashSet<>(Arrays.asList(
            "server.properties", "eula.txt", "server.jar",
            "whitelist.json", "ops.json", "white-list.json",
            "banned-players.json", "banned-ips.json", "usercache.json",
            "server-icon.png", "version", "manifest.etag", "previous_manifest.json"
    ));

    /** Top-level directories that must never be touched. */
    private static final Set<String> PROTECTED_DIRS = new HashSet<>(Arrays.asList(
            "world", "world_nether", "world_the_end", "logs", "crash-reports",
            "backups", ".modpack-store", "versions", "libraries", "assets"
    ));

    private Cleaner() {
    }

    /** Returns the list of removed relative paths. */
    static List<String> cleanup(Config config, Manifest manifest) throws IOException {
        Set<String> wanted = new HashSet<>();
        for (ManifestFile f : manifest.files) {
            wanted.add(normalize(f.path));
        }
        List<String> removed = new ArrayList<>();
        for (String dir : MANAGED_DIRS) {
            Path root = config.serverRoot.resolve(dir);
            if (!Files.isDirectory(root)) {
                continue;
            }
            final List<Path> candidates = new ArrayList<>();
            Files.walkFileTree(root, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    candidates.add(file);
                    return FileVisitResult.CONTINUE;
                }
            });
            for (Path file : candidates) {
                Path rel = config.serverRoot.relativize(file);
                String normalized = normalize(rel.toString());
                if (wanted.contains(normalized) || wanted.contains(normalized.toLowerCase())) {
                    continue;
                }
                if (isProtected(rel)) {
                    continue;
                }
                Files.deleteIfExists(file);
                removed.add(normalized);
            }
        }
        if (!removed.isEmpty()) {
            System.out.println("[modpack-store] Removed " + removed.size() + " obsolete files.");
        }
        return removed;
    }

    private static boolean isProtected(Path rel) {
        if (rel.getNameCount() == 0) {
            return true;
        }
        String top = rel.getName(0).toString();
        if (PROTECTED_DIRS.contains(top)) {
            return true;
        }
        String fileName = rel.getFileName().toString();
        return PROTECTED_FILES.contains(fileName);
    }

    private static String normalize(String path) {
        return path.replace('\\', '/');
    }
}
