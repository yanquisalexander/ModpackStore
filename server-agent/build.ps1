#Requires -Version 5.1
<#
.SYNOPSIS
  Builds modpack-store-agent.jar with javac/jar only (no Maven needed).
.EXAMPLE
  .\build.ps1
#>
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$classes = Join-Path $root "target\classes"
$testClasses = Join-Path $root "target\test-classes"
$jar = Join-Path $root "target\modpack-store-agent.jar"

Remove-Item -Recurse -Force $classes, $testClasses -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $classes, $testClasses -Force | Out-Null

$mainSources = Get-ChildItem -LiteralPath (Join-Path $root "src\main\java") -Recurse -Filter "*.java" | ForEach-Object { $_.FullName }
$testSources = Get-ChildItem -LiteralPath (Join-Path $root "src\test\java") -Recurse -Filter "*.java" | ForEach-Object { $_.FullName }

$mainArgs = @('--release', '17', '-encoding', 'UTF-8', '-d', $classes) + $mainSources
& javac @mainArgs
if ($LASTEXITCODE -ne 0) { throw "javac (main) failed" }

$testArgs = @('--release', '17', '-encoding', 'UTF-8', '-cp', $classes, '-d', $testClasses) + $testSources
& javac @testArgs
if ($LASTEXITCODE -ne 0) { throw "javac (test) failed" }

& java -ea -cp "$classes;$testClasses" dev.alexitoo.modpackstore.agent.AgentSelfTest
if ($LASTEXITCODE -ne 0) { throw "self tests failed" }

$manifest = Join-Path $env:TEMP "modpack-agent-manifest-$PID.mf"
@"
Manifest-Version: 1.0
Premain-Class: dev.alexitoo.modpackstore.agent.ModpackAgent
Agent-Class: dev.alexitoo.modpackstore.agent.ModpackAgent
Main-Class: dev.alexitoo.modpackstore.agent.Main
Can-Redefine-Classes: false
Can-Retransform-Classes: false
Can-Set-Native-Method-Prefix: false
"@ | Set-Content -LiteralPath $manifest -Encoding ASCII

& jar --create --file $jar --manifest $manifest -C $classes .
if ($LASTEXITCODE -ne 0) { throw "jar failed" }
Remove-Item -LiteralPath $manifest -Force -ErrorAction SilentlyContinue

Write-Host "Built: $jar"
