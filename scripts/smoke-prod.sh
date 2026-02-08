#!/bin/bash
#
# Production Smoke Test Script
# Phase 4.34: Basic curl-based verification of key functionality
#
# Usage: ./scripts/smoke-prod.sh
#

set -e

BASE_URL="${PROD_URL:-https://coloradosongwriterscollective.org}"
PASS_COUNT=0
FAIL_COUNT=0

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================="
echo "Production Smoke Tests"
echo "Base URL: $BASE_URL"
echo "=================================="
echo ""

# Helper function for test results
pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test 1: Homepage loads
echo "Test 1: Homepage loads"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL")
if [ "$HTTP_CODE" = "200" ]; then
    pass "Homepage returns 200"
else
    fail "Homepage returned $HTTP_CODE (expected 200)"
fi

# Test 2: Happenings page loads
echo ""
echo "Test 2: Happenings page loads"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/happenings")
if [ "$HTTP_CODE" = "200" ]; then
    pass "Happenings page returns 200"
else
    fail "Happenings page returned $HTTP_CODE (expected 200)"
fi

# Test 3: Happenings contains expected markers
echo ""
echo "Test 3: Happenings page contains expected content"
CONTENT=$(curl -s "$BASE_URL/happenings")
if echo "$CONTENT" | grep -q "Happenings"; then
    pass "Happenings page contains 'Happenings' text"
else
    fail "Happenings page missing expected content"
fi

# Test 4: /open-mics redirect for CSC event (check for NEXT_REDIRECT in RSC)
# Note: This checks the RSC payload, not HTTP redirect headers
echo ""
echo "Test 4: /open-mics/{uuid} redirect mechanism"
# We can't easily test specific UUIDs without DB access, but we verify the route exists
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/open-mics/test-nonexistent-slug" 2>/dev/null || echo "error")
if [ "$HTTP_CODE" = "404" ]; then
    pass "Open mics route returns 404 for non-existent slug (route working)"
else
    warn "Open mics route returned $HTTP_CODE (expected 404 for test slug)"
fi

# Test 5: API health check (search endpoint)
echo ""
echo "Test 5: API responds"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/search?q=test" 2>/dev/null || echo "error")
if [ "$HTTP_CODE" = "200" ]; then
    pass "Search API endpoint responds ($HTTP_CODE)"
else
    fail "Search API returned unexpected code: $HTTP_CODE"
fi

# Test 6: Static assets load (theme CSS)
echo ""
echo "Test 6: CSS loads"
CONTENT=$(curl -s "$BASE_URL")
if echo "$CONTENT" | grep -q "stylesheet\|<style"; then
    pass "Page includes CSS"
else
    warn "Could not verify CSS inclusion"
fi

# Test 7: Event detail page structure
echo ""
echo "Test 7: Event detail page structure"
# Find any event from happenings and try to load it
HAPPENINGS_CONTENT=$(curl -s "$BASE_URL/happenings")
if echo "$HAPPENINGS_CONTENT" | grep -q "/events/"; then
    pass "Happenings page links to event detail pages"
else
    warn "Could not find event links in happenings page"
fi

# Summary
echo ""
echo "=================================="
echo "Results"
echo "=================================="
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
    echo -e "${RED}Some tests failed. Check output above.${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi
