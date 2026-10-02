package dev.alexitoo.modpackstore.agent;

import java.util.Collections;
import java.util.List;

/** Parsed modpack manifest for {@code ?target=server}. */
public final class Manifest {
    /** Version string (e.g. {@code "1.4.2"}); may be empty if the backend omits it. */
    public final String version;
    public final List<ManifestFile> files;

    public Manifest(String version, List<ManifestFile> files) {
        this.version = version == null ? "" : version;
        this.files = Collections.unmodifiableList(files);
    }
}
