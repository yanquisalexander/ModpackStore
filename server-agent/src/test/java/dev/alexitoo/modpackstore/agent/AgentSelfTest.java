package dev.alexitoo.modpackstore.agent;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Dependency-free self test. Run with assertions enabled:
 * <pre>
 * java -ea -cp ... dev.alexitoo.modpackstore.agent.AgentSelfTest
 * </pre>
 */
public final class AgentSelfTest {

    public static void main(String[] args) throws Exception {
        testJsonFlatObject();
        testJsonManifest();
        testJsonLatest();
        testConfigParsing();
        testSha1();
        testSafePath();
        testCleanerProtection();
        System.out.println("ALL SELF TESTS PASSED");
    }

    private static void testJsonFlatObject() {
        Map<String, String> m = Json.parseFlatStringObject("{\"apiBase\":\"https://x/v1\",\"n\":42,\"b\":true}");
        assert "https://x/v1".equals(m.get("apiBase"));
        assert m.size() == 1 : "only string values kept, got " + m;
    }

    private static void testJsonManifest() {
        String body = "{\"manifest\":{\"id\":\"v1\",\"version\":\"1.4.2\","
                + "\"files\":[{\"path\":\"mods/a.jar\",\"fileHash\":\"ABCDEF\",\"downloadUrl\":\"/resources/files/ab/cd/ABCDEF\","
                + "\"file\":{\"size\":123}},{\"path\":\"x\",\"fileHash\":\"h\",\"downloadUrl\":\"u\"}]}}";
        Manifest m = Json.parseManifest(body);
        assert "1.4.2".equals(m.version);
        assert m.files.size() == 2;
        assert "mods/a.jar".equals(m.files.get(0).path);
        assert "abcdef".equals(m.files.get(0).fileHash) : "hash lowercased";
        assert m.files.get(0).size == 123;
    }

    private static void testJsonLatest() {
        Map<String, String> m = Json.parseLatestVersion("{\"latestVersion\":{\"id\":\"uuid-1\",\"version\":\"2.0\"}}");
        assert "uuid-1".equals(m.get("id"));
        assert "2.0".equals(m.get("version"));
    }

    private static void testConfigParsing() {
        Map<String, String> m = Config.parseArgs("modpack=abc,version=latest");
        assert "abc".equals(m.get("modpack"));
        assert "latest".equals(m.get("version"));
        Map<String, String> cli = Config.parseArgs("--modpack abc\n--server-root /srv/mc");
        assert "abc".equals(cli.get("modpack"));
        assert "/srv/mc".equals(cli.get("server-root"));
    }

    private static void testSha1() throws Exception {
        Path tmp = Files.createTempFile("agent-test", ".bin");
        try {
            Files.write(tmp, new byte[0]);
            // SHA-1 of empty input is well-known.
            assert "da39a3ee5e6b4b0d3255bfef95601890afd80709".equals(Verifier.sha1Hex(tmp));
            assert Verifier.matches(tmp, "DA39A3EE5E6B4B0D3255BFEF95601890AFD80709") : "case-insensitive";
            assert !Verifier.matches(tmp, "00".repeat(20)) : "wrong hash rejected";
        } finally {
            Files.deleteIfExists(tmp);
        }
    }

    private static void testSafePath() {
        Installer.assertSafePath("mods/a.jar");
        for (String bad : new String[]{"../escape.jar", "..\\escape.jar", "/abs/path.jar", "C:\\win.jar", ""}) {
            boolean rejected = false;
            try {
                Installer.assertSafePath(bad);
            } catch (IllegalArgumentException e) {
                rejected = true;
            }
            assert rejected : "should reject " + bad;
        }
    }

    private static void testCleanerProtection() throws Exception {
        Path root = Files.createTempDirectory("agent-cleaner");
        try {
            Files.createDirectories(root.resolve("mods"));
            Files.createDirectories(root.resolve("world"));
            Files.write(root.resolve("mods").resolve("old.jar"), new byte[]{1});
            Files.write(root.resolve("world").resolve("level.dat"), new byte[]{2});
            Files.write(root.resolve("server.properties"), new byte[]{3});
            Files.createDirectories(root.resolve("mods").resolve("keep"));
            Files.write(root.resolve("mods").resolve("keep").resolve("new.jar"), new byte[]{4});

            Config config = new Config("https://x/v1", "https://cdn.example", "m", "latest", "t", root);
            Manifest manifest = new Manifest("1", List.of(
                    new ManifestFile("mods/keep/new.jar", "h", "u", -1)));
            List<String> removed = Cleaner.cleanup(config, manifest);
            assert removed.size() == 1 && removed.get(0).equals("mods/old.jar") : removed;
            assert Files.exists(root.resolve("world").resolve("level.dat")) : "world protected";
            assert Files.exists(root.resolve("server.properties")) : "server.properties protected";
            assert Files.exists(root.resolve("mods").resolve("keep").resolve("new.jar"));
        } finally {
            deleteTree(root);
        }
    }

    private static void deleteTree(Path root) throws Exception {
        if (!Files.exists(root)) {
            return;
        }
        try (java.util.stream.Stream<Path> walk = Files.walk(root)) {
            for (Path p : walk.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(p);
            }
        }
    }
}
