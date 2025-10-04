#!/bin/bash

# Redis Cache Implementation Test Script
# This script tests the Redis caching implementation for modpack version manifests

set -e

echo "=== Redis Cache Implementation Test ==="
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
MODPACK_ID="${MODPACK_ID}"
VERSION_ID="${VERSION_ID}"
AUTH_TOKEN="${AUTH_TOKEN}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check prerequisites
if [ -z "$MODPACK_ID" ] || [ -z "$VERSION_ID" ]; then
    print_error "MODPACK_ID and VERSION_ID environment variables are required"
    echo ""
    echo "Usage:"
    echo "  export MODPACK_ID='your-modpack-id'"
    echo "  export VERSION_ID='your-version-id'"
    echo "  export AUTH_TOKEN='your-auth-token'  # Optional"
    echo "  ./test-redis-cache.sh"
    exit 1
fi

echo "Configuration:"
echo "  API URL: $API_URL"
echo "  Modpack ID: $MODPACK_ID"
echo "  Version ID: $VERSION_ID"
echo "  Auth Token: ${AUTH_TOKEN:+[SET]}"
echo ""

# Build headers
HEADERS=()
if [ -n "$AUTH_TOKEN" ]; then
    HEADERS+=(-H "Authorization: Bearer $AUTH_TOKEN")
fi

# Test 1: Health Check
echo "Test 1: Health Check"
echo "--------------------"
HEALTH_RESPONSE=$(curl -s "${API_URL}/v1/public/health")
echo "$HEALTH_RESPONSE" | jq '.'

CACHE_ENABLED=$(echo "$HEALTH_RESPONSE" | jq -r '.cache.enabled')
if [ "$CACHE_ENABLED" = "true" ]; then
    print_success "Redis cache is enabled and connected"
else
    print_error "Redis cache is not connected - tests will show fallback behavior"
fi
echo ""

# Test 2: First Request (Cache Miss)
echo "Test 2: First Request - Cache Miss"
echo "-----------------------------------"
RESPONSE1=$(curl -s -i "${HEADERS[@]}" \
    "${API_URL}/v1/explore/modpacks/${MODPACK_ID}/versions/${VERSION_ID}")

HTTP_STATUS1=$(echo "$RESPONSE1" | grep -i "HTTP" | head -1 | awk '{print $2}')
ETAG1=$(echo "$RESPONSE1" | grep -i "etag:" | cut -d' ' -f2- | tr -d '\r')
CACHE_CONTROL1=$(echo "$RESPONSE1" | grep -i "cache-control:" | cut -d' ' -f2- | tr -d '\r')

echo "HTTP Status: $HTTP_STATUS1"
echo "ETag: $ETAG1"
echo "Cache-Control: $CACHE_CONTROL1"

if [ "$HTTP_STATUS1" = "200" ]; then
    print_success "Request successful (200 OK)"
else
    print_error "Unexpected status: $HTTP_STATUS1"
fi

if [ -n "$ETAG1" ]; then
    print_success "ETag header present"
else
    print_error "ETag header missing"
fi

if echo "$CACHE_CONTROL1" | grep -q "immutable"; then
    print_success "Cache-Control header has 'immutable'"
else
    print_error "Cache-Control header missing 'immutable'"
fi
echo ""

# Test 3: Second Request (Cache Hit)
echo "Test 3: Second Request - Cache Hit"
echo "-----------------------------------"
sleep 1
RESPONSE2=$(curl -s -i "${HEADERS[@]}" \
    "${API_URL}/v1/explore/modpacks/${MODPACK_ID}/versions/${VERSION_ID}")

HTTP_STATUS2=$(echo "$RESPONSE2" | grep -i "HTTP" | head -1 | awk '{print $2}')
ETAG2=$(echo "$RESPONSE2" | grep -i "etag:" | cut -d' ' -f2- | tr -d '\r')

echo "HTTP Status: $HTTP_STATUS2"
echo "ETag: $ETAG2"

if [ "$HTTP_STATUS2" = "200" ]; then
    print_success "Request successful (200 OK)"
else
    print_error "Unexpected status: $HTTP_STATUS2"
fi

if [ "$ETAG1" = "$ETAG2" ]; then
    print_success "ETag is consistent across requests"
else
    print_error "ETag changed between requests (should be stable)"
fi
echo ""

# Test 4: Conditional Request (304 Not Modified)
echo "Test 4: Conditional Request - 304 Not Modified"
echo "-----------------------------------------------"
if [ -n "$ETAG1" ]; then
    RESPONSE3=$(curl -s -i "${HEADERS[@]}" \
        -H "If-None-Match: $ETAG1" \
        "${API_URL}/v1/explore/modpacks/${MODPACK_ID}/versions/${VERSION_ID}")
    
    HTTP_STATUS3=$(echo "$RESPONSE3" | grep -i "HTTP" | head -1 | awk '{print $2}')
    
    echo "HTTP Status: $HTTP_STATUS3"
    
    if [ "$HTTP_STATUS3" = "304" ]; then
        print_success "Received 304 Not Modified (ETag working correctly)"
    else
        print_error "Expected 304, got $HTTP_STATUS3"
    fi
else
    print_info "Skipping (no ETag from previous request)"
fi
echo ""

# Test 5: Latest Version Endpoint
echo "Test 5: Latest Version Endpoint"
echo "--------------------------------"
LATEST_RESPONSE=$(curl -s -i "${HEADERS[@]}" \
    "${API_URL}/v1/explore/modpacks/${MODPACK_ID}/versions/latest")

HTTP_STATUS_LATEST=$(echo "$LATEST_RESPONSE" | grep -i "HTTP" | head -1 | awk '{print $2}')
ETAG_LATEST=$(echo "$LATEST_RESPONSE" | grep -i "etag:" | cut -d' ' -f2- | tr -d '\r')

echo "HTTP Status: $HTTP_STATUS_LATEST"
echo "ETag: $ETAG_LATEST"

if [ "$HTTP_STATUS_LATEST" = "200" ]; then
    print_success "Latest version request successful"
else
    print_error "Unexpected status: $HTTP_STATUS_LATEST"
fi

if [ -n "$ETAG_LATEST" ]; then
    print_success "Latest version has ETag (manifest is cached)"
else
    print_error "Latest version missing ETag"
fi
echo ""

# Test 6: Cache Statistics
echo "Test 6: Cache Statistics"
echo "------------------------"
HEALTH_RESPONSE2=$(curl -s "${API_URL}/v1/public/health")
CACHE_STATS=$(echo "$HEALTH_RESPONSE2" | jq -r '.cache.stats')

if [ "$CACHE_STATS" != "null" ]; then
    echo "$CACHE_STATS" | jq '.'
    HITS=$(echo "$CACHE_STATS" | jq -r '.hits')
    MISSES=$(echo "$CACHE_STATS" | jq -r '.misses')
    print_success "Cache statistics available (Hits: $HITS, Misses: $MISSES)"
else
    print_info "Cache statistics not available (Redis may not be connected)"
fi
echo ""

# Summary
echo "=== Test Summary ==="
echo ""
echo "All tests completed. Review the output above for detailed results."
echo ""
echo "Expected behavior:"
echo "  1. Health check shows cache enabled"
echo "  2. First request returns 200 with ETag and Cache-Control"
echo "  3. Second request returns 200 with same ETag"
echo "  4. Conditional request with If-None-Match returns 304"
echo "  5. Latest version endpoint works and caches manifest"
echo "  6. Cache statistics show hits and misses"
echo ""
echo "If Redis is not connected, all requests will work but without caching."
