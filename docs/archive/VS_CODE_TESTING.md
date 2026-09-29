# 🚀 VS Code Testing Guide for APIX CLI

This guide shows you how to easily test APIX CLI commands directly within VS Code.

## 🎯 Quick Start

### Method 1: NPM Scripts (Recommended)

Use these simple npm commands in the VS Code terminal:

```bash
# Basic commands
npm run apix:help           # Show CLI help
npm run apix:health         # Quick health check
npm run apix:analyze        # Analyze current project

# Integration commands
npm run apix:add:hts        # Add HTS token integration
npm run apix:add:wallet     # Add wallet integration
npm run apix:recommend      # Get AI recommendations
npm run apix:validate       # Validate on testnet

# Enterprise commands
npm run apix:generate       # Generate enterprise code
npm run apix:chat           # Interactive chat mode
npm run apix:status         # Check integration status
npm run apix:init           # Initialize APIX config

# Development commands
npm run install:global      # Install APIX globally
npm run link:local          # Link APIX locally for development
npm run unlink              # Uninstall global APIX
```

### Method 2: VS Code Tasks

1. **Open Command Palette**: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. **Type**: `Tasks: Run Task`
3. **Select** any APIX task:
   - APIX: Health Check
   - APIX: Analyze Project
   - APIX: Add HTS Token
   - APIX: Add Wallet Integration
   - APIX: Get Recommendations
   - APIX: Validate on Testnet
   - And more...

### Method 3: Quick Test Script

Use the convenient test script:

```bash
# Show usage and available commands
./scripts/test-cli.sh

# Quick tests
./scripts/test-cli.sh health
./scripts/test-cli.sh analyze
./scripts/test-cli.sh add hts MyToken MYT
./scripts/test-cli.sh recommend pharmaceutical

# Development tests
./scripts/test-cli.sh typecheck
./scripts/test-cli.sh mocks
./scripts/test-cli.sh build
```

## 🔧 VS Code Debugging

### Launch Configurations

Use the built-in debug configurations:

1. **Open Debug Panel**: `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)
2. **Select Configuration**:
   - Debug APIX CLI - Help
   - Debug APIX CLI - Health Check
   - Debug APIX CLI - Analyze
   - Debug APIX CLI - Add HTS
   - Debug APIX CLI - Custom Command
   - Debug APIX CLI - External Project

3. **Press F5** to start debugging

### Debugging Custom Commands

Use the "Debug APIX CLI - Custom Command" configuration:

1. Edit `.vscode/launch.json`
2. Modify the `args` array for your specific command
3. Set breakpoints in your code
4. Press F5

Example:
```json
{
  "name": "Debug APIX CLI - Custom Command",
  "args": ["add", "wallet", "--provider", "hashpack"]
}
```

## 📁 Testing with External Projects

### Option 1: Run from External Project Directory

```bash
# Navigate to your test project
cd /path/to/your-test-project

# Run APIX commands using full path
npx ts-node "/Users/diop/Personal Experimental Projects/hedera_hackaton/apix/src/cli/index.ts" analyze --directory .
npx ts-node "/Users/diop/Personal Experimental Projects/hedera_hackaton/apix/src/cli/index.ts" add hts --name TestToken --symbol TEST
```

### Option 2: Use Global Installation

```bash
# Install APIX globally (from APIX directory)
npm run install:global

# Then use anywhere
cd /path/to/your-test-project
apix analyze --directory .
apix add hts --name TestToken --symbol TEST
```

### Option 3: Use VS Code Multi-root Workspace

1. **Create workspace**: `File > Add Folder to Workspace`
2. **Add both**: APIX project + your test project
3. **Run APIX tasks** from the APIX folder while working on test project

## ✅ Recommended Workflow

### For Development:
1. **Health Check**: `npm run apix:health`
2. **Type Check**: `./scripts/test-cli.sh typecheck`
3. **Test Command**: `npm run apix:analyze`
4. **Audit Mocks**: `./scripts/test-cli.sh mocks`

### For Integration Testing:
1. **Create test project** (Next.js/React)
2. **Navigate to test project**
3. **Run APIX command** with full path or global install
4. **Verify results**

### For Debugging:
1. **Set breakpoints** in VS Code
2. **Use debug configuration** closest to your use case
3. **Modify args** in launch.json if needed
4. **Press F5** to debug

## 🎨 VS Code Extensions

The following extensions are automatically recommended:
- TypeScript and JavaScript Language Features
- Prettier - Code formatter
- ESLint
- JSON Language Features
- Node.js debugging support
- Terminal utilities

## 🔍 Troubleshooting

### Common Issues:

**Command not found:**
```bash
# Make sure you're in the APIX directory
cd "/Users/diop/Personal Experimental Projects/hedera_hackaton/apix"
npm run apix:health
```

**TypeScript errors:**
```bash
# Check compilation
./scripts/test-cli.sh typecheck

# View specific errors
npm run build:check
```

**Permission denied:**
```bash
# Make script executable
chmod +x scripts/test-cli.sh
```

**Path issues with spaces:**
```bash
# Use quotes for paths with spaces
npx ts-node "/Users/diop/Personal Experimental Projects/hedera_hackaton/apix/src/cli/index.ts" --help
```

## 📚 Available Commands Reference

| Command | Description | npm script | Task |
|---------|-------------|------------|------|
| `--help` | Show CLI help | `apix:help` | APIX: Help |
| `health --quick` | Health check | `apix:health` | APIX: Health Check |
| `analyze --directory .` | Analyze project | `apix:analyze` | APIX: Analyze Project |
| `add hts --name X --symbol Y` | Add HTS integration | `apix:add:hts` | APIX: Add HTS Token |
| `add wallet --provider P` | Add wallet integration | `apix:add:wallet` | APIX: Add Wallet Integration |
| `recommend --industry I` | Get recommendations | `apix:recommend` | APIX: Get Recommendations |
| `validate --testnet` | Validate on testnet | `apix:validate` | APIX: Validate on Testnet |
| `generate TYPE` | Generate enterprise code | `apix:generate` | APIX: Generate Enterprise Code |
| `chat` | Interactive chat mode | `apix:chat` | APIX: Interactive Chat |
| `status` | Check integration status | `apix:status` | APIX: Check Status |
| `init` | Initialize APIX config | `apix:init` | APIX: Initialize Project |

Happy testing! 🎉