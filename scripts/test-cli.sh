#!/bin/bash

# APIX CLI Quick Test Script
# Usage: ./scripts/test-cli.sh <command> [args...]
# Examples:
#   ./scripts/test-cli.sh health
#   ./scripts/test-cli.sh analyze /path/to/project
#   ./scripts/test-cli.sh add hts MyToken MYT

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APIX_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🚀 APIX CLI Quick Test${NC}"
echo -e "${BLUE}========================${NC}"

# Check if we're in the right directory
if [ ! -f "$APIX_DIR/package.json" ]; then
    echo -e "${RED}❌ Error: Not in APIX project directory${NC}"
    echo -e "${YELLOW}Please run this script from the APIX project root or ensure package.json exists${NC}"
    exit 1
fi

# Change to APIX directory
cd "$APIX_DIR"

# Function to run CLI command
run_cli() {
    echo -e "${YELLOW}📋 Running: apix $*${NC}"
    echo -e "${BLUE}----------------------------------------${NC}"
    npx ts-node src/cli/index.ts "$@"
    echo -e "${BLUE}----------------------------------------${NC}"
}

# Function to show usage
show_usage() {
    echo -e "${GREEN}Usage: $0 <command> [args...]${NC}"
    echo ""
    echo -e "${GREEN}Quick Commands:${NC}"
    echo -e "  ${YELLOW}health${NC}                     - Quick health check"
    echo -e "  ${YELLOW}analyze [path]${NC}             - Analyze project (default: current dir)"
    echo -e "  ${YELLOW}add hts [name] [symbol]${NC}    - Add HTS integration"
    echo -e "  ${YELLOW}add wallet [provider]${NC}      - Add wallet integration"
    echo -e "  ${YELLOW}recommend [industry]${NC}       - Get recommendations"
    echo -e "  ${YELLOW}validate${NC}                   - Validate on testnet"
    echo -e "  ${YELLOW}generate [type]${NC}            - Generate enterprise code"
    echo -e "  ${YELLOW}chat${NC}                       - Interactive chat mode"
    echo -e "  ${YELLOW}status${NC}                     - Check integration status"
    echo -e "  ${YELLOW}init${NC}                       - Initialize APIX config"
    echo -e "  ${YELLOW}help${NC}                       - Show CLI help"
    echo ""
    echo -e "${GREEN}Development Commands:${NC}"
    echo -e "  ${YELLOW}build${NC}                      - Build TypeScript"
    echo -e "  ${YELLOW}typecheck${NC}                  - Check TypeScript compilation"
    echo -e "  ${YELLOW}mocks${NC}                      - Audit mock implementations"
    echo -e "  ${YELLOW}install-global${NC}             - Install APIX globally"
    echo -e "  ${YELLOW}link${NC}                       - Link APIX locally"
    echo ""
    echo -e "${GREEN}Examples:${NC}"
    echo -e "  ${BLUE}$0 health${NC}"
    echo -e "  ${BLUE}$0 analyze /path/to/my-project${NC}"
    echo -e "  ${BLUE}$0 add hts MyToken MYT${NC}"
    echo -e "  ${BLUE}$0 recommend pharmaceutical${NC}"
}

# Main command processing
case "$1" in
    "health")
        run_cli health --quick
        ;;
    "analyze")
        if [ -n "$2" ]; then
            run_cli analyze --directory "$2"
        else
            run_cli analyze --directory .
        fi
        ;;
    "add")
        case "$2" in
            "hts")
                name="${3:-TestToken}"
                symbol="${4:-TEST}"
                run_cli add hts --name "$name" --symbol "$symbol"
                ;;
            "wallet")
                provider="${3:-hashpack}"
                run_cli add wallet --provider "$provider"
                ;;
            *)
                echo -e "${RED}❌ Error: Unknown integration type '$2'${NC}"
                echo -e "${YELLOW}Supported: hts, wallet${NC}"
                exit 1
                ;;
        esac
        ;;
    "recommend")
        industry="${2:-pharmaceutical}"
        run_cli recommend --industry "$industry"
        ;;
    "validate")
        run_cli validate --testnet
        ;;
    "generate")
        type="${2:-pharmaceutical-compliance}"
        run_cli generate "$type"
        ;;
    "chat")
        run_cli chat
        ;;
    "status")
        run_cli status
        ;;
    "init")
        run_cli init
        ;;
    "help")
        run_cli --help
        ;;
    "build")
        echo -e "${YELLOW}📦 Building TypeScript...${NC}"
        npm run build
        ;;
    "typecheck")
        echo -e "${YELLOW}🔍 Checking TypeScript compilation...${NC}"
        npm run build:check
        ;;
    "mocks")
        echo -e "${YELLOW}🔍 Auditing mock implementations...${NC}"
        npm run audit:mocks
        ;;
    "install-global")
        echo -e "${YELLOW}🌍 Installing APIX globally...${NC}"
        npm run install:global
        ;;
    "link")
        echo -e "${YELLOW}🔗 Linking APIX locally...${NC}"
        npm run link:local
        ;;
    "")
        show_usage
        ;;
    *)
        echo -e "${RED}❌ Error: Unknown command '$1'${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac

echo -e "${GREEN}✅ Command completed!${NC}"