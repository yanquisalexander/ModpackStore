#!/bin/bash

# Custom AppImage build script for ModpackStore
# This script completes the AppImage build process when Tauri's linuxdeploy fails

set -e

APP_DIR="/home/runner/work/ModpackStore/ModpackStore/application"
BUNDLE_DIR="$APP_DIR/src-tauri/target/release/bundle/appimage"
APPDIR_NAME="Modpack Store.AppDir"

echo "=== Custom AppImage Build Script ==="
echo "Working directory: $BUNDLE_DIR"

cd "$BUNDLE_DIR"

# Check if AppDir exists
if [ ! -d "$APPDIR_NAME" ]; then
    echo "ERROR: AppDir not found at $BUNDLE_DIR/$APPDIR_NAME"
    exit 1
fi

echo "✓ Found AppDir: $APPDIR_NAME"

# Download appimagetool if not present
if [ ! -f "appimagetool" ]; then
    echo "Downloading appimagetool..."
    wget -q https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage -O appimagetool
    chmod +x appimagetool
fi

# Download runtime if not present
if [ ! -f "runtime-x86_64" ]; then
    echo "Downloading AppImage runtime..."
    wget -q https://github.com/AppImage/type2-runtime/releases/download/continuous/runtime-x86_64 -O runtime-x86_64
fi

# Create AppImage
echo "Creating AppImage..."
./appimagetool --runtime-file runtime-x86_64 "$APPDIR_NAME" "Modpack_Store-x86_64.AppImage"

if [ -f "Modpack_Store-x86_64.AppImage" ]; then
    echo "✓ AppImage created successfully: $(ls -lh Modpack_Store-x86_64.AppImage | awk '{print $5}')"
    echo "✓ AppImage location: $BUNDLE_DIR/Modpack_Store-x86_64.AppImage"
else
    echo "ERROR: AppImage creation failed"
    exit 1
fi

echo "=== AppImage Build Complete ==="