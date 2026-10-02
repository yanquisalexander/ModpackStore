package dev.alexitoo.modpackstore.agent;

/**
 * CLI entry point (sidecar mode). Runs the exact same update as
 * {@link ModpackAgent#premain}, for hosts where JVM flags cannot be changed:
 *
 * <pre>
 * java -jar modpack-store-agent.jar --modpack &lt;id&gt; [--version latest] [--api https://...] [--server-root .]
 * set MODPACK_TOKEN=mps_...
 * </pre>
 */
public final class Main {

    private Main() {
    }

    public static void main(String[] args) {
        try {
            Config config = Config.resolve(joinArgs(args));
            new ModpackUpdater(config).update();
        } catch (Exception e) {
            System.err.println("[modpack-store] FATAL: " + e.getMessage());
            e.printStackTrace(System.err);
            System.exit(1);
        }
    }

    private static String joinArgs(String[] args) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < args.length; i++) {
            if (i > 0) {
                sb.append('\n');
            }
            sb.append(args[i]);
        }
        return sb.toString();
    }
}
