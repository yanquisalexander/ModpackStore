#!/usr/bin/env bash
# Builds modpack-store-agent.jar with javac/jar only (no Maven needed).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
CLASSES="$ROOT/target/classes"
TEST_CLASSES="$ROOT/target/test-classes"
JAR="$ROOT/target/modpack-store-agent.jar"

rm -rf "$CLASSES" "$TEST_CLASSES"
mkdir -p "$CLASSES" "$TEST_CLASSES"

find "$ROOT/src/main/java" -name '*.java' > /tmp/agent-main-sources.txt
find "$ROOT/src/test/java" -name '*.java' > /tmp/agent-test-sources.txt

javac --release 17 -encoding UTF-8 -d "$CLASSES" @/tmp/agent-main-sources.txt
javac --release 17 -encoding UTF-8 -cp "$CLASSES" -d "$TEST_CLASSES" @/tmp/agent-test-sources.txt

java -ea -cp "$CLASSES:$TEST_CLASSES" dev.alexitoo.modpackstore.agent.AgentSelfTest

MANIFEST="$(mktemp)"
cat > "$MANIFEST" <<'EOF'
Manifest-Version: 1.0
Premain-Class: dev.alexitoo.modpackstore.agent.ModpackAgent
Agent-Class: dev.alexitoo.modpackstore.agent.ModpackAgent
Main-Class: dev.alexitoo.modpackstore.agent.Main
Can-Redefine-Classes: false
Can-Retransform-Classes: false
Can-Set-Native-Method-Prefix: false
EOF

jar --create --file "$JAR" --manifest "$MANIFEST" -C "$CLASSES" .
rm -f "$MANIFEST"
echo "Built: $JAR"
