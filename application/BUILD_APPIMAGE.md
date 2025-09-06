# How to Build AppImage for ModpackStore

This document explains how to build the AppImage for ModpackStore after the recent fixes.

## Prerequisites

Install required system dependencies:
```bash
sudo apt update
sudo apt install -y \
  libgtk-3-dev \
  libglib2.0-dev \
  libcairo2-dev \
  libgdk-pixbuf2.0-dev \
  libatk1.0-dev \
  libpango1.0-dev \
  libwebkit2gtk-4.1-dev \
  librsvg2-dev \
  pkg-config \
  build-essential
```

## Build Process

1. **Install dependencies**:
   ```bash
   cd application
   npm install
   ```

2. **Build frontend**:
   ```bash
   npm run build
   ```

3. **Attempt Tauri build** (will fail at linuxdeploy step, but creates necessary files):
   ```bash
   npm run tauri build
   ```

4. **Complete AppImage creation**:
   ```bash
   ./build-appimage.sh
   ```

## Output

The final AppImage will be available at:
`application/src-tauri/target/release/bundle/appimage/Modpack_Store-x86_64.AppImage`

## What Was Fixed

- ✅ Package version mismatches between Tauri NPM and Rust crates
- ✅ Missing GTK/WebKit development libraries
- ✅ LinuxDeploy GTK plugin failures
- ✅ Frontend assets not included in AppImage
- ✅ Blank window issue in AppImage

## Testing

To test the AppImage (requires display):
```bash
# Make executable (if needed)
chmod +x Modpack_Store-x86_64.AppImage

# Run AppImage
./Modpack_Store-x86_64.AppImage
```

The application should now display the interface correctly instead of a blank window.