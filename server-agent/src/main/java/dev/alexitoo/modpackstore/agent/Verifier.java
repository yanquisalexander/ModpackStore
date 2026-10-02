package dev.alexitoo.modpackstore.agent;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;

/**
 * SHA-1 file verification. The backend stores file identities as SHA-1 hex
 * ({@code modpack_files.hash}, see the Tauri client {@code download_manager.rs}),
 * so the agent must use the same algorithm — NOT SHA-256.
 */
final class Verifier {

    private Verifier() {
    }

    /** Returns lowercase SHA-1 hex of a file. */
    static String sha1Hex(Path file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-1");
        byte[] buf = new byte[65536];
        try (InputStream in = Files.newInputStream(file)) {
            int read;
            while ((read = in.read(buf)) >= 0) {
                digest.update(buf, 0, read);
            }
        }
        return toHex(digest.digest());
    }

    static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }

    /** True when the file exists and its SHA-1 matches (case-insensitive). */
    static boolean matches(Path file, String expectedHash) {
        try {
            if (!Files.isRegularFile(file)) {
                return false;
            }
            return sha1Hex(file).equalsIgnoreCase(expectedHash);
        } catch (Exception e) {
            return false;
        }
    }
}
