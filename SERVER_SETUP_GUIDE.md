# ModpackStore Authentication - Server Setup Guide

This guide is for Minecraft server administrators who want to enable ModpackStore authentication on their servers.

## What is ModpackStore Authentication?

ModpackStore Authentication allows players using the ModpackStore launcher to join your server without needing a Microsoft/Mojang account. Players authenticate using their ModpackStore account, providing a secure alternative authentication method.

## Prerequisites

- Java 8 or higher
- Minecraft server (any version 1.7+)
- Internet connection for authlib-injector download

## Quick Start

### 1. Download authlib-injector

Download the latest authlib-injector from:
```
https://github.com/yushijinhun/authlib-injector/releases/latest
```

Save it to your server directory, e.g., `authlib-injector-1.2.5.jar`

### 2. Configure Server Properties

Edit your `server.properties`:
```properties
# Enable online mode for authentication
online-mode=true

# Optional: Allow players to use custom skins
allow-flight=false
```

### 3. Update Server Startup Script

Modify your server startup command to include authlib-injector:

**Linux/Mac:**
```bash
#!/bin/bash
java -Xmx4G -Xms4G \
  -javaagent:authlib-injector-1.2.5.jar=https://api.modpackstore.com/yggdrasil \
  -jar server.jar nogui
```

**Windows (start.bat):**
```batch
@echo off
java -Xmx4G -Xms4G ^
  -javaagent:authlib-injector-1.2.5.jar=https://api.modpackstore.com/yggdrasil ^
  -jar server.jar nogui
pause
```

### 4. Start Your Server

Run your updated startup script. The server will now authenticate players through ModpackStore.

## Configuration Options

### API Endpoint

By default, the server uses `https://api.modpackstore.com/yggdrasil`. If you need to use a different endpoint (development/testing), modify the URL:

```bash
-javaagent:authlib-injector.jar=https://your-custom-endpoint.com/yggdrasil
```

### JVM Arguments Position

The `-javaagent` argument must come **before** the `-jar` argument:

✅ Correct:
```bash
java -javaagent:authlib-injector.jar=... -jar server.jar
```

❌ Incorrect:
```bash
java -jar server.jar -javaagent:authlib-injector.jar=...
```

## Verification

### Check Server Logs

When the server starts, you should see authlib-injector initialization:

```
[authlib-injector] Version: 1.2.5
[authlib-injector] API: https://api.modpackstore.com/yggdrasil
[authlib-injector] Prefetching metadata...
[authlib-injector] Metadata fetched successfully
```

### Test Player Connection

1. Have a player with ModpackStore launcher join
2. Check server logs for authentication:
```
[Server thread/INFO]: UUID of player PlayerName is abc123-...
[Server thread/INFO]: PlayerName joined the game
```

## Compatibility

### Server Types

ModpackStore authentication works with:
- ✅ Vanilla Minecraft servers
- ✅ Spigot / Paper
- ✅ Forge servers
- ✅ Fabric servers
- ✅ Hybrid servers (e.g., Mohist, Magma)

### Minecraft Versions

- ✅ 1.7.x - 1.20.x (all versions)
- ✅ Snapshots (should work but not guaranteed)

### Operating Systems

- ✅ Linux
- ✅ Windows
- ✅ macOS
- ✅ Docker containers

## Advanced Configuration

### Multiple Authentication Methods

You can allow both Microsoft and ModpackStore accounts by using authlib-injector. The system will:
1. First try Microsoft authentication (default)
2. Fall back to ModpackStore if Microsoft auth fails

### Whitelist

Use UUIDs for whitelisting:
```bash
# Get player UUID from first join
/whitelist add PlayerName

# Or use UUID directly
/whitelist add abc123-def456-...
```

### Permissions

ModpackStore authenticated players work with all permission plugins (LuckPerms, PermissionsEx, etc.) using their UUIDs.

### Offline Mode Players

If you want to support both online and offline mode:
- Online mode = Required for ModpackStore auth
- Offline mode = Anyone can join without authentication

You cannot have both simultaneously. Choose one:
- `online-mode=true` → Secure, authenticated players only
- `online-mode=false` → Insecure, anyone can join

## Troubleshooting

### Players Cannot Connect

**Issue:** "Failed to verify username!"

**Solutions:**
1. Verify authlib-injector is in the correct location
2. Check `-javaagent` argument is before `-jar`
3. Ensure server has internet connection
4. Verify API endpoint is accessible
5. Check server logs for authlib-injector errors

### Invalid Session

**Issue:** "Invalid session (Try restarting your game)"

**Solutions:**
1. Player should restart ModpackStore launcher
2. Player should re-launch the instance
3. Check if player's ModpackStore session is expired (20 min timeout)

### Authentication Server Down

**Issue:** "Authentication servers are down"

**Solutions:**
1. Check ModpackStore API status
2. Verify your server can reach `api.modpackstore.com`
3. Check firewall rules allow outbound HTTPS
4. Wait and retry (temporary API issue)

### authlib-injector Not Loading

**Issue:** No authlib-injector messages in logs

**Solutions:**
1. Verify JAR file is not corrupted (re-download)
2. Check JVM version is compatible (Java 8+)
3. Ensure correct file path in `-javaagent`
4. Check file permissions (must be readable)

### Skins Not Loading

**Issue:** Players have default Steve/Alex skins

**Solutions:**
1. Verify ModpackStore user has uploaded a skin
2. Check API endpoint is correct
3. Wait a few minutes (skin cache refresh)
4. Player should re-join the server

## Docker Setup

If running in Docker, add authlib-injector to your Dockerfile:

```dockerfile
FROM itzg/minecraft-server:latest

# Download authlib-injector
ADD https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar /data/authlib-injector.jar

# Set environment variable for JVM options
ENV JAVA_TOOL_OPTIONS="-javaagent:/data/authlib-injector.jar=https://api.modpackstore.com/yggdrasil"

# Standard server settings
ENV EULA=TRUE
ENV ONLINE_MODE=TRUE
```

Or with Docker Compose:

```yaml
version: '3.8'
services:
  minecraft:
    image: itzg/minecraft-server:latest
    environment:
      EULA: "TRUE"
      ONLINE_MODE: "TRUE"
      JVM_OPTS: "-javaagent:/data/authlib-injector.jar=https://api.modpackstore.com/yggdrasil"
    volumes:
      - ./authlib-injector.jar:/data/authlib-injector.jar:ro
      - ./data:/data
    ports:
      - "25565:25565"
```

## Security Considerations

### Session Security

- Sessions expire after 24 hours
- Inactive sessions timeout after 20 minutes
- Each server join requires fresh validation

### IP Validation

The authentication system supports optional IP validation. Players must connect from the same IP they authenticated from.

### Token Security

- Access tokens are randomly generated (64-char hex)
- Tokens are transmitted over HTTPS only
- Tokens cannot be reused across different servers simultaneously

### Best Practices

1. ✅ Always use HTTPS for API endpoints
2. ✅ Keep authlib-injector updated
3. ✅ Enable server firewall (only port 25565)
4. ✅ Use whitelist for private servers
5. ✅ Regular server backups
6. ❌ Don't share authlib-injector download from unknown sources
7. ❌ Don't use HTTP (unencrypted) API endpoints

## Performance Impact

### Resource Usage

authlib-injector has minimal performance impact:
- Memory: ~5-10MB additional RAM
- CPU: Negligible (<1% during authentication)
- Network: One API call per player join (~5KB)

### Optimization

For high-traffic servers:
- Enable server-side caching (if available)
- Use CDN for skin delivery (automatic with ModpackStore)
- Consider dedicated authentication server (enterprise)

## Getting Help

### Support Channels

- ModpackStore Discord: [Link]
- GitHub Issues: https://github.com/yanquisalexander/ModpackStore/issues
- Email: support@modpackstore.com

### Reporting Issues

Include in your report:
1. Server version (e.g., Paper 1.20.1)
2. authlib-injector version
3. Relevant server logs
4. Steps to reproduce
5. Expected vs actual behavior

## FAQ

**Q: Do all players need ModpackStore accounts?**
A: No, Microsoft accounts work alongside ModpackStore accounts.

**Q: Does this work with BungeeCord/Velocity?**
A: Yes, add authlib-injector to each backend server.

**Q: Can I customize authentication?**
A: Contact ModpackStore for enterprise customization options.

**Q: Is this free?**
A: Yes, ModpackStore authentication is free for all servers.

**Q: What data is collected?**
A: Only username, UUID, and authentication status. See privacy policy.

**Q: Can I use this commercially?**
A: Yes, commercial use is allowed.

## Updates

Check for authlib-injector updates regularly:
```bash
# Check current version
java -jar authlib-injector.jar --version

# Download latest
wget https://github.com/yushijinhun/authlib-injector/releases/latest/download/authlib-injector.jar
```

## Examples

### Example 1: Basic Vanilla Server

```bash
#!/bin/bash
java -Xmx2G -Xms2G \
  -javaagent:authlib-injector.jar=https://api.modpackstore.com/yggdrasil \
  -jar minecraft_server.1.20.1.jar nogui
```

### Example 2: Forge Server with Mods

```bash
#!/bin/bash
java -Xmx6G -Xms6G \
  -XX:+UseG1GC \
  -javaagent:authlib-injector.jar=https://api.modpackstore.com/yggdrasil \
  -jar forge-1.20.1-47.2.0.jar nogui
```

### Example 3: Paper Server with Optimizations

```bash
#!/bin/bash
java -Xmx8G -Xms8G \
  -XX:+UseG1GC \
  -XX:+ParallelRefProcEnabled \
  -XX:MaxGCPauseMillis=200 \
  -XX:+UnlockExperimentalVMOptions \
  -XX:+DisableExplicitGC \
  -XX:+AlwaysPreTouch \
  -javaagent:authlib-injector.jar=https://api.modpackstore.com/yggdrasil \
  -jar paper-1.20.1.jar nogui
```

## License

This guide is part of ModpackStore documentation. Free to use and distribute.

## Changelog

- 2024-01-XX: Initial release
- Support for Minecraft 1.7-1.20.x
- Full Yggdrasil protocol compatibility
