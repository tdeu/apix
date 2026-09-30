#!/bin/bash

# APIX AI - Mock Implementation Detection Script
# Automatically scans codebase for mock implementations and TODO items

echo "🔍 APIX AI Mock Implementation Audit"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to search and display results
search_mocks() {
    local pattern="$1"
    local description="$2"
    local color="$3"

    echo -e "${color}${description}${NC}"
    echo "----------------------------------------"

    results=$(grep -rn --include="*.ts" --include="*.js" "$pattern" src/ 2>/dev/null || true)

    if [ -n "$results" ]; then
        echo "$results" | while IFS= read -r line; do
            file=$(echo "$line" | cut -d: -f1)
            line_num=$(echo "$line" | cut -d: -f2)
            content=$(echo "$line" | cut -d: -f3-)
            echo "  📍 $file:$line_num"
            echo "     $content"
            echo ""
        done
    else
        echo "  ✅ No instances found"
        echo ""
    fi
}

# Search for different types of mock implementations
echo -e "${RED}🚨 CRITICAL MOCK IMPLEMENTATIONS${NC}"
echo ""

search_mocks "mock mode\|Mock.*implementation\|TODO.*implement.*actual" "Mock Implementations" "$RED"

search_mocks "getMock.*\|mockStrategy\|mock.*:" "Mock Methods/Data" "$RED"

search_mocks "placeholder.*type\|as any.*mock\|Mock.*for now" "Type Placeholders" "$RED"

echo -e "${YELLOW}⚠️  DEVELOPMENT PLACEHOLDERS${NC}"
echo ""

search_mocks "TODO\|FIXME\|XXX" "TODO Items" "$YELLOW"

search_mocks "in development\|coming soon\|not implemented" "Development Messages" "$YELLOW"

search_mocks "temporarily disabled\|commented out" "Temporary Disables" "$YELLOW"

echo -e "${BLUE}ℹ️  CONFIGURATION DEPENDENCIES${NC}"
echo ""

search_mocks "process\.env\." "Environment Variables" "$BLUE"

search_mocks "API.*KEY\|api.*key" "API Key References" "$BLUE"

search_mocks "HEDERA.*\|hedera.*credential" "Hedera Configuration" "$BLUE"

echo -e "${GREEN}📊 SUMMARY${NC}"
echo "=================================="

# Count totals
mock_count=$(grep -rn --include="*.ts" --include="*.js" "mock mode\|Mock.*implementation\|TODO.*implement.*actual\|getMock.*\|mockStrategy" src/ 2>/dev/null | wc -l || echo "0")
todo_count=$(grep -rn --include="*.ts" --include="*.js" "TODO\|FIXME\|XXX" src/ 2>/dev/null | wc -l || echo "0")
env_count=$(grep -rn --include="*.ts" --include="*.js" "process\.env\." src/ 2>/dev/null | wc -l || echo "0")

echo "🔴 Mock implementations found: $mock_count"
echo "🟡 TODO items found: $todo_count"
echo "🔵 Environment dependencies: $env_count"
echo ""

# Production readiness score
total_issues=$((mock_count + todo_count))
if [ "$total_issues" -eq 0 ]; then
    echo -e "${GREEN}✅ No mock implementations found${NC}"
elif [ "$total_issues" -le 5 ]; then
    echo -e "${YELLOW}⚠️  Nearly ready: Few remaining items${NC}"
else
    echo -e "${RED}🚨 Development mode: Multiple mock implementations need attention${NC}"
fi

echo ""
echo "📋 Next steps:"
echo "1. Follow the never-fake-success rule in CLAUDE.md"
echo "2. Set up required environment variables"
echo "3. Replace critical mock implementations"
echo "4. Test with real API calls"
echo ""
echo "🔧 Run with real APIs:"
echo "export OPENAI_API_KEY=your_key"
echo "export HEDERA_ACCOUNT_ID=your_id"
echo "export HEDERA_PRIVATE_KEY=your_key"
echo "npm run build && npm test"