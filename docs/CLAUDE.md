# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚀 Project Overview

**APIX AI** is an Enterprise AI-powered Hedera blockchain development CLI that provides intelligent code generation, live blockchain validation, and seamless integration patterns. The tool serves as a universal gateway to Hedera's distributed ledger services with AI-powered analysis and code composition.

### Architecture Overview

```
src/
├── cli/                    # CLI entry points and command handlers
│   ├── index.ts           # Main CLI program with 16+ commands
│   ├── cli-core.ts        # Core business logic implementation
│   └── chat-interface.ts  # Conversational AI interface
├── services/              # Core blockchain services
│   └── hedera-operations.ts # Real blockchain operations
├── validation/            # Blockchain and integration validation
│   ├── health-checker.ts  # System health monitoring
│   └── agent-kit/         # Hedera Agent Kit integration
├── generation/            # Code and template generation
├── analysis/              # Project analysis and framework detection
├── planning/              # Integration planning and recommendations
├── templates/             # Handlebars template system
├── ai/                    # AI systems and LangChain integration
├── utils/                 # Configuration, logging, test accounts
└── types/                 # TypeScript type definitions
```

## Essential Commands

### Development Workflow
```bash
# Check compilation status (MUST pass before commits)
npm run build:check

# Development mode CLI testing (no API keys required)
npm run apix:help                    # CLI help
npm run apix:health                  # System health check
npm run apix:analyze                 # Project analysis
npm run apix:add:hts                 # Add HTS integration
npm run apix:create-token            # Create blockchain token

# Environment validation
npm run validate:env                 # Check API key setup
npm run audit:mocks                  # Count mock implementations

# Pre-commit workflow
npm run precommit                    # build:check + lint
```

### CLI Testing
```bash
# Direct ts-node execution (development)
npx ts-node src/cli/index.ts --help
npx ts-node src/cli/index.ts health --quick
npx ts-node src/cli/index.ts analyze --directory .
npx ts-node src/cli/index.ts create-token --name "TestToken" --symbol "TEST"

# Global installation testing
npm run link:local                   # Link for system-wide testing
apix --help                         # Test global installation
npm run unlink                      # Remove global link
```

## Critical Development Rules

### 1. Compilation Policy
- **Zero tolerance** for TypeScript compilation errors before commits
- Run `npm run build:check` before any commit
- Current target: Under 5 compilation errors
- Use `error: any` pattern for consistent error handling

### 2. Mock Implementation Strategy
- All mocks documented in `MOCK_DATA_AUDIT.md`
- Clear TODO comments: `// TODO: Replace with real HederaAgentKit integration`
- Log mock usage: `logger.info('Feature running in mock mode', { feature: 'xyz' })`
- Graceful degradation: CLI must work without API keys

### 3. Progressive Enhancement Pattern
```typescript
export class SomeService {
  private realService: RealService | null = null;

  private initializeService(): void {
    try {
      if (process.env.API_KEY) {
        this.realService = new RealService();
      } else {
        logger.warn('Service running in mock mode');
      }
    } catch (error: any) {
      logger.error('Failed to initialize service:', error);
    }
  }
}
```

## Key Systems Architecture

### CLI Command Pipeline
1. **CLI Entry** (`src/cli/index.ts`) - Commander.js with 16+ commands
2. **Core Logic** (`src/cli/cli-core.ts`) - All command implementations
3. **Progress Tracking** (`src/utils/progress.ts`) - Professional progress display
4. **Error Handling** - Consistent patterns with graceful degradation

### Blockchain Integration Architecture
1. **Hedera Operations Service** (`src/services/hedera-operations.ts`)
   - Real blockchain token creation using Hedera SDK
   - Test account management and fallback handling
   - Hedera Agent Kit integration with graceful degradation
2. **Agent Kit Validator** (`src/validation/agent-kit/`)
   - Comprehensive validation for HTS, HCS, Smart Contracts
   - Enterprise validation with compliance checking
3. **Test Account System** (`src/utils/test-accounts.ts`)
   - Automated test account creation and management
   - Balance monitoring and validation

### Template and Generation System
1. **Template Engine** (`src/templates/template-engine.ts`) - Handlebars-based
2. **Integration Generator** (`src/generation/integration-generator.ts`)
3. **Framework Detection** (`src/analysis/project-analyzer.ts`)
   - Next.js, React, Express, CLI project support
   - Dependency analysis and existing integration detection

### AI Integration Points
1. **Enterprise Classifier** (`src/ai/classifiers/`) - LangChain integration
2. **Business Intent Detection** - Rule-based with AI fallbacks
3. **Code Composition** - Template-based with AI enhancement (mocked)

## Technology Stack

### Core Dependencies
- **Hedera SDK** (`@hashgraph/sdk: ^2.40.0`) - Direct blockchain operations
- **Hedera Agent Kit** (`hedera-agent-kit: ^3.2.0`) - High-level blockchain abstraction
- **LangChain** (`@langchain/openai, @langchain/anthropic`) - AI integration
- **Commander.js** (`^11.1.0`) - CLI framework
- **Handlebars** (`^4.7.8`) - Template engine
- **Inquirer** (`^9.2.12`) - Interactive prompts

### Framework Support
- **Primary**: Next.js (App Router + Pages Router)
- **Secondary**: React (CRA, Vite), Express.js, Node.js CLI tools
- **Languages**: TypeScript preferred, JavaScript supported

## Common Patterns

### Error Handling Pattern
```typescript
try {
  // operation
} catch (error: any) {
  logger.error('Operation failed:', error);
  throw error;
}
```

### Blockchain Operation Pattern
```typescript
// Initialize with test account fallback
await hederaOperations.initialize();

// Perform operation with mock detection
const result = await hederaOperations.createToken({
  name: "TestToken",
  symbol: "TEST",
  decimals: 8,
  initialSupply: 1000000
});

if (result.success) {
  console.log('Token ID:', result.tokenId);
  console.log('Explorer URL:', result.explorerUrl);
}
```

### Configuration Management
```typescript
import { ConfigurationManager } from '../utils/config-manager';

const config = new ConfigurationManager();
const hederaConfig = await config.getHederaConfig();
```

## Current Implementation Status

### ✅ Fully Working
- **Core CLI Commands**: All 16+ commands implemented and functional
- **Project Analysis**: Framework detection, dependency analysis
- **Template Generation**: Handlebars-based file generation
- **VS Code Integration**: Complete tasks, debugging, scripts
- **Basic Blockchain Operations**: Token creation with Hedera SDK
- **Test Account Management**: Automated account creation and validation

### 🟡 Partially Working
- **Hedera Agent Kit Integration**: Direct SDK operations with Agent Kit structure
- **AI Classification**: Rule-based with LangChain integration ready
- **Validation System**: Health checks work, blockchain validation ongoing

### ⚠️ Advanced Features (In Development)
- **Advanced AI Features**: Code composition, conversational interface
- **Wallet Integration**: HashPack, Blade, WalletConnect (in development)

## Testing Strategy

### Non-Blockchain Commands (No Credentials Required)
```bash
apix --help                          # ✅ Always works
apix analyze --directory .           # ✅ Real project analysis
apix health --quick                  # ✅ System health check
apix add hts --name MyToken         # ✅ Generates real TypeScript files
```

### Blockchain Operations (Requires Hedera Credentials)
```bash
# Required: Set up Hedera testnet account (free HBAR)
export HEDERA_ACCOUNT_ID=0.0.xxxxx
export HEDERA_PRIVATE_KEY=302e...
export HEDERA_NETWORK=testnet

npm run validate:env                 # Verify credentials
apix create-token --name TestToken   # Real blockchain operation (testnet is FREE!)
```

**Note**: All blockchain operations now execute real transactions. Use testnet for development (free HBAR from https://portal.hedera.com/faucet)

## Environment Variables

### Required for Live Blockchain Operations
```bash
HEDERA_ACCOUNT_ID=0.0.xxxxx         # Hedera account ID
HEDERA_PRIVATE_KEY=302e...           # ED25519 private key
HEDERA_NETWORK=testnet               # testnet or mainnet
```

### Optional for AI Features
```bash
OPENAI_API_KEY=sk-...                # OpenAI API key
ANTHROPIC_API_KEY=sk-ant-...         # Anthropic API key
```

## Debugging and Development

### Common Issues
1. **"Cannot find module 'hedera-agent-kit'"**: Expected, service uses fallback
2. **TypeScript errors**: Run `npm run build:check`, fix systematically
3. **"Hedera client not initialized"**: Set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in .env
4. **Need testnet HBAR**: Get free testnet account and HBAR from https://portal.hedera.com/faucet

### Debug Commands
```bash
# Compilation status
npm run build:check 2>&1 | grep "error TS" | wc -l

# Mock implementation count
npm run audit:mocks

# Environment check
npm run validate:env

# Test basic functionality
npm run apix:health
```

## Development Priorities

### Before Making Changes
1. Ensure `npm run build:check` shows minimal errors
2. Test basic CLI functionality: `npm run apix:help`
3. Check mock status: `npm run audit:mocks`

### When Adding Features
1. Non-blockchain features should work without credentials
2. Blockchain features must require valid Hedera credentials
3. Provide clear error messages when credentials are missing
4. Add tests for new functionality
5. Run `npm run precommit` before committing

## Key Commands for New Contributors

| Command | Purpose | Status |
|---------|---------|--------|
| `npm run build:check` | TypeScript compilation check | ⚡ Critical |
| `npm run apix:health` | Basic functionality test | ✅ Working |
| `npm run apix:analyze` | Project analysis test | ✅ Working |
| `npm run apix:create-token` | Real blockchain operation | ✅ Working (requires credentials) |
| `npm run validate:env` | Verify credentials setup | ✅ Working |

**Important**: All blockchain operations now require valid Hedera credentials. Use testnet for development (free HBAR available).

## 🚀 APIX AI - Complete Command Reference

### **Core Analysis & Planning Commands**

```bash
# Project Analysis
apix analyze                           # Analyze project and suggest Hedera integrations
apix analyze --directory <path>        # Analyze specific directory
apix analyze --verbose                 # Show detailed analysis

# Integration Planning
apix recommend                         # Get integration recommendations
apix recommend --industry <industry>   # Industry-specific recommendations

# Project Initialization
apix init                             # Initialize new Hedera project
apix status                           # Show current project status
```

### **Integration & Code Generation**

```bash
# Add Integrations
apix add hts                          # Add Hedera Token Service integration
apix add hts --name "MyToken"         # Add HTS with specific token name
apix add wallet --provider hashpack  # Add wallet integration
apix add consensus                    # Add Hedera Consensus Service

# Code Generation
apix generate smart-contract          # Generate smart contract integration
apix generate <integration>          # Generate specific integration type
apix compose                         # AI-powered code composition
```

### **🆕 AI-Powered Commands**

```bash
# AI Confidence Assessment
apix confidence "Create NFT marketplace"              # Assess implementation confidence
apix confidence "DeFi protocol" --industry finance   # Industry-specific assessment
apix confidence "Supply chain" --detailed            # Detailed confidence breakdown

# AI Debug Assistance
apix debug "Token creation fails"                    # AI-powered debugging
apix debug "Network timeout" --suggest-fixes        # Get fix suggestions
apix debug "Account error" --files src/token.ts     # Analyze specific files
apix debug "Build failure" --logs build.log         # Analyze log files

# Enterprise Deployment
apix deploy --environment production                 # Production deployment analysis
apix deploy --compliance-check                      # Include compliance validation
apix deploy --audit-trail                          # Enable audit logging
apix deploy --rollback-plan                        # Generate rollback procedures
apix deploy --monitoring                            # Setup monitoring
apix deploy --dry-run                              # Simulate deployment
```

### **Blockchain Operations**

```bash
# Token Operations
apix create-token                                   # Create token on Hedera
apix create-token --name "MyToken" --symbol "MTK"  # Create with specific details
apix create-token --supply 1000000                 # Set initial supply

# Wallet Management
apix wallet connect hashpack                       # Connect HashPack wallet
apix wallet connect blade                          # Connect Blade wallet
apix wallet connect walletconnect                  # Connect WalletConnect wallet
apix wallet connect metamask-snap                  # Connect MetaMask Hedera Snap
apix wallet disconnect                             # Disconnect current wallet
apix wallet list                                   # List available wallets
```

### **Validation & Health**

```bash
# System Health
apix health                           # Comprehensive system health check
apix health --quick                   # Quick health verification

# Validation
apix validate                         # Validate integrations
apix validate --testnet               # Validate on testnet
apix validate --enterprise            # Enterprise validation
apix validate --performance           # Performance validation
```

### **Interactive & Help**

```bash
# Interactive Mode
apix chat                            # Start interactive AI chat mode

# Information & Help
apix --help                          # Show all available commands
apix <command> --help                # Get help for specific command
apix explain <integration>           # Explain integration details
apix compare <integration1> <integration2>  # Compare integrations
```

### **Development & Debugging**

```bash
# Logging & Debug
apix logs                            # View recent logs
apix logs --follow                   # Follow logs in real-time
apix last-error                      # Show last error details
apix debug-info                      # System debug information

# Global Options (can be used with any command)
--debug                              # Enable debug logging
--verbose                            # Enable verbose output
--trace                              # Enable trace logging with stack traces
--log-file <path>                    # Custom log file path
--no-file-logging                   # Disable file logging
```

### **🆕 Quick Start Examples**

```bash
# Complete workflow example
apix init                                           # Initialize project
apix analyze                                        # Analyze current setup
apix confidence "Build DeFi lending platform"      # Assess confidence
apix add hts --name "LendingToken"                 # Add token integration
apix create-token --name "LendingToken" --symbol "LEND"  # Create on blockchain
apix deploy --environment staging --dry-run        # Test deployment plan
apix health --quick                                 # Verify everything works
```

### **Package.json Script Shortcuts**

```bash
# Pre-configured npm scripts
npm run apix:help                    # Quick help
npm run apix:health                  # System health check
npm run apix:analyze                 # Project analysis
npm run apix:chat                    # Start chat mode
npm run apix:create-token            # Create demo token
npm run apix:validate                # Full validation
```

## 🔧 **Environment Setup**

```bash
# Required for live blockchain operations
export HEDERA_ACCOUNT_ID=0.0.xxxxx
export HEDERA_PRIVATE_KEY=302e...
export HEDERA_NETWORK=testnet

# Optional for enhanced AI features
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export WALLETCONNECT_PROJECT_ID=your-project-id
```

## 📊 **Feature Status**

- ✅ **All commands fully implemented**
- ✅ **Real blockchain operations** (requires Hedera credentials)
- ✅ **AI-powered analysis and debugging**
- ✅ **Code generation and templates** (works without credentials)
- 🔄 **Wallet integrations** (in development)
- 🔄 **Enterprise deployment features** (in development)

**IMPORTANT UPDATE (Nov 2025)**: Simulation mode has been removed. All blockchain operations now execute real transactions and require valid Hedera credentials. Use testnet for development - free HBAR available at https://portal.hedera.com/faucet