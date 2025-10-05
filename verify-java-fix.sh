#!/bin/bash
# Test script to verify Java Manager fix

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Java Manager Fix - Verification Script                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if javaPath is set in instance.json
check_java_path() {
    local instance_dir=$1
    local instance_file="$instance_dir/instance.json"
    
    if [ ! -f "$instance_file" ]; then
        echo -e "${RED}✗ Instance file not found: $instance_file${NC}"
        return 1
    fi
    
    local java_path=$(jq -r '.javaPath' "$instance_file")
    
    if [ "$java_path" = "null" ] || [ -z "$java_path" ]; then
        echo -e "${RED}✗ FAIL: javaPath is null or empty${NC}"
        echo "   File: $instance_file"
        return 1
    else
        echo -e "${GREEN}✓ PASS: javaPath is set to: $java_path${NC}"
        echo "   File: $instance_file"
        return 0
    fi
}

# Main test execution
echo "This script helps verify that the Java Manager fix is working correctly."
echo "It checks if instance.json files have the javaPath field properly set."
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠ Warning: 'jq' is not installed. Install it to use this script.${NC}"
    echo "   Install: sudo apt-get install jq (Ubuntu/Debian)"
    echo "   Install: brew install jq (macOS)"
    exit 1
fi

# Find instances directory
INSTANCES_DIR=""

# Try common locations
if [ -d "$HOME/.config/dev.alexitoo.modpackstore/instances" ]; then
    INSTANCES_DIR="$HOME/.config/dev.alexitoo.modpackstore/instances"
elif [ -d "$HOME/AppData/Local/dev.alexitoo.modpackstore/instances" ]; then
    INSTANCES_DIR="$HOME/AppData/Local/dev.alexitoo.modpackstore/instances"
fi

if [ -z "$INSTANCES_DIR" ] || [ ! -d "$INSTANCES_DIR" ]; then
    echo -e "${YELLOW}⚠ No instances directory found in default locations.${NC}"
    echo "   Please provide the path to your instances directory:"
    read -p "   Path: " INSTANCES_DIR
    
    if [ ! -d "$INSTANCES_DIR" ]; then
        echo -e "${RED}✗ Directory not found: $INSTANCES_DIR${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}Found instances directory: $INSTANCES_DIR${NC}"
echo ""

# Count instances
instance_count=$(find "$INSTANCES_DIR" -maxdepth 1 -type d | wc -l)
instance_count=$((instance_count - 1)) # Subtract the parent directory

if [ $instance_count -eq 0 ]; then
    echo -e "${YELLOW}⚠ No instances found. Create a new instance to test the fix.${NC}"
    exit 0
fi

echo "Found $instance_count instance(s)"
echo ""

# Test each instance
passed=0
failed=0

for instance_dir in "$INSTANCES_DIR"/*; do
    if [ -d "$instance_dir" ]; then
        instance_name=$(basename "$instance_dir")
        echo "Testing instance: $instance_name"
        
        if check_java_path "$instance_dir"; then
            ((passed++))
        else
            ((failed++))
        fi
        echo ""
    fi
done

# Summary
echo "═══════════════════════════════════════════════════════════"
echo "Test Summary:"
echo "  Total instances: $instance_count"
echo -e "  ${GREEN}Passed: $passed${NC}"
echo -e "  ${RED}Failed: $failed${NC}"
echo "═══════════════════════════════════════════════════════════"

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✓ All instances have javaPath correctly set!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some instances have missing javaPath. These may be old instances created before the fix.${NC}"
    echo ""
    echo "Recommendation:"
    echo "  - New instances should have javaPath set correctly"
    echo "  - Old instances with null javaPath will use global Java (fallback behavior)"
    echo "  - To fix old instances: Delete and recreate them, or manually set javaPath"
    exit 1
fi
