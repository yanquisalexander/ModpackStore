package dev.alexitoo.modpackstore.agent;

import java.lang.instrument.Instrumentation;

/**
 * Modpack Store server agent.
 *
 * <p>Usage:
 * <pre>
 * java -javaagent:modpack-store-agent.jar -jar server.jar nogui
 * </pre>
 *
 * <p>The {@code premain} hook runs BEFORE {@code MinecraftServer.main()}, so the
 * modpack is fully synced before the server boots. If the update fails, the JVM
 * exits with code 1 and the server never starts half-updated.
 *
 * <p>Zero dependencies: only JDK stdlib, so it can never clash with
 * Forge/Fabric/NeoForge classes. It also coexists with other agents
 * (e.g. authlib-agent) — just add multiple {@code -javaagent} flags.
 */
public final class ModpackAgent {

    private ModpackAgent() {
    }

    public static void premain(String agentArgs, Instrumentation inst) {
        try {
            Config config = Config.resolve(agentArgs);
            new ModpackUpdater(config).update();
        } catch (Exception e) {
            System.err.println("[modpack-store] FATAL: could not update modpack: " + e.getMessage());
            e.printStackTrace(System.err);
            System.err.println("[modpack-store] Aborting server start to avoid running half-updated.");
            System.exit(1);
        }
    }

    /** Allows late attach / manual runs via {@code -jar} for debugging. */
    public static void agentmain(String agentArgs, Instrumentation inst) {
        premain(agentArgs, inst);
    }
}
