package dev.alexitoo.modpackstore.agent;

import java.util.Collections;
import java.util.List;

/** A single file entry of a modpack manifest (server target). */
public final class ManifestFile {
    public final String path;
    /** SHA-1 hex (lowercase), matches {@code modpack_files.hash} in the backend. */
    public final String fileHash;
    public final String downloadUrl;
    /** Expected size in bytes, or -1 if unknown. */
    public final long size;

    public ManifestFile(String path, String fileHash, String downloadUrl, long size) {
        this.path = path;
        this.fileHash = fileHash;
        this.downloadUrl = downloadUrl;
        this.size = size;
    }
}
