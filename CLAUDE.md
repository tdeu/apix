# CLAUDE.md - APIX AI Development Guide

This file contains essential information for Claude Code instances working on the APIX AI codebase. Read this first before making any changes.

## 🚀 Project Overview

**APIX AI** is an Enterprise AI-powered Hedera development assistant CLI tool that provides:
- AI code composition for complex Hedera integrations
- Live blockchain validation using Hedera Agent Kit v3.2.0
- Enterprise-grade templates with compliance frameworks
- Progressive enhancement system (50%, 30%, 15%, 5% effort allocation)
- Conversational development interface

### Core Architecture

```
src/
├── cli/                    # CLI entry points and command handlers
│   ├── index.ts           # Main CLI program with 15+ commands
│   ├── cli-core.ts        # Core business logic implementation
│   └── chat-interface.ts  # Conversational AI interface
├── ai/                    # AI systems and engines
│   ├── classifiers/       # Enterprise requirement classification
│   ├── composition/       # AI code composition engine
│   ├── conversation/      # Multi-turn conversation handling
│   ├── limitations/       # AI limitation and fallback handling
│   └── recovery/          # Error recovery systems
├── validation/            # Blockchain and code validation
│   ├── health-checker.ts  # System health monitoring
│   ├── integration-validator.ts # Integration validation
│   └── agent-kit/        # Hedera Agent Kit integration
├── generation/            # Code and template generation
├── analysis/              # Project analysis and detection
├── templates/             # Handlebars template system
├── security/              # Security scanning and compliance
├── performance/           # Performance optimization
├── testing/               # Comprehensive test suites
├── types/                 # TypeScript type definitions
└── utils/                 # Utilities, config, logging
```

## 🛠️ Essential Commands

### Quick Status Check
```bash
# Check compilation status (MUST pass before any commits)
npm run build:check

# Audit mock implementations
npm run audit:mocks

# Validate environment setup
npm run validate:env

# Basic CLI functionality test
npm run cli:help
npm run cli:health --quick
npm run cli:analyze --directory .
```

### Development Workflow
```bash
# Before starting work
npm run build:check  # MUST show 0 errors
npm run audit:mocks  # Check current mock count

# After making changes
npm run build:check  # Fix any new errors immediately
npm run lint         # Fix linting issues

# Before committing
npm run precommit    # Runs build:check + lint automatically
```

### CLI Testing (No API Keys Required)
```bash
# Basic commands that should always work
npx ts-node src/cli/index.ts --help
npx ts-node src/cli/index.ts health --quick
npx ts-node src/cli/index.ts analyze --directory .
npx ts-node src/cli/index.ts recommend --industry pharmaceutical

# These work in mock mode without credentials
npx ts-node src/cli/index.ts generate pharmaceutical-compliance
npx ts-node src/cli/index.ts validate --testnet
```

## 🚨 Critical Development Rules

### 1. Zero Tolerance Compilation Policy
- **NO commits allowed** with TypeScript compilation errors
- Run `npm run build:check` before any commit
- Current target: Under 5 compilation errors
- Fix compilation errors before adding new features

### 2. Mock Implementation Tracking
- All mock implementations MUST be documented in `MOCK_DATA_AUDIT.md`
- Use clear TODO comments: `// TODO: Replace with real HederaAgentKit integration`
- Log mock mode usage: `logger.info('Feature running in mock mode', { feature: 'xyz' })`
- Current mock count: 28 implementations (see `npm run audit:mocks`)

### 3. Graceful Degradation
- CLI must work without API keys (development mode)
- Show clear "mock mode" or "development mode" messages
- Provide value even with limited functionality
- Never fail silently - always explain what's happening

## 📁 Key Files to Understand

### Core Entry Points
- **`src/cli/index.ts`**: Main CLI program with 15+ commands (analyze, add, generate, validate, etc.)
- **`src/cli/cli-core.ts`**: Core business logic, all command implementations
- **`package.json`**: Dependencies, scripts, version 2.0.0

### Type System
- **`src/types/index.ts`**: Core type definitions (ProjectContext, IntegrationOptions, etc.)
- **`src/types/enterprise.ts`**: Enterprise AI types (BusinessIntent, EnterpriseClassification)
- **`src/types/security.ts`**: Security and compliance types
- **`src/types/conversation.ts`**: Conversational AI types
- **`src/types/performance.ts`**: Performance monitoring types

### Critical Systems
- **`src/utils/config-manager.ts`**: Configuration management (.apix/config.json)
- **`src/utils/logger.ts`**: Structured logging with levels
- **`src/validation/health-checker.ts`**: System health monitoring
- **`src/ai/classifiers/enterprise-classifier.ts`**: AI classification with LangChain

### Development Infrastructure
- **`DEVELOPMENT_WORKFLOW.md`**: Detailed development guidelines
- **`MOCK_DATA_AUDIT.md`**: Comprehensive mock implementation tracking
- **`scripts/audit-mocks.sh`**: Automated mock detection script

## 🔌 Technology Stack

### Core Dependencies
```json
{
  "hedera-agent-kit": "^3.2.0",          // Blockchain validation
  "@langchain/openai": "^0.3.0",         // Primary AI provider
  "@langchain/anthropic": "^0.3.0",      // Secondary AI provider
  "@langchain/core": "^0.3.0",           // LangChain core
  "@hashgraph/sdk": "^2.40.0",           // Hedera SDK
  "commander": "^11.1.0",                // CLI framework
  "inquirer": "^9.2.12",                 // Interactive prompts
  "handlebars": "^4.7.8",                // Template engine
  "chalk": "^4.1.2",                     // Terminal colors
  "ora": "^5.4.1"                        // Spinners
}
```

### Framework Support
- **Primary**: Next.js applications
- **Secondary**: React (CRA, Vite), Express.js
- **Language**: TypeScript preferred, JavaScript supported
- **Package Managers**: npm, yarn, pnpm

## 🏗️ Common Implementation Patterns

### Error Handling
```typescript
// Use this pattern for error handling
try {
  // operation
} catch (error: any) {  // Note: ': any' to avoid TypeScript error
  logger.error('Operation failed:', error);
  throw error;
}
```

### Mock Implementation Pattern
```typescript
export class SomeService {
  private realService: RealService | null = null;

  constructor() {
    this.initializeService();
  }

  private initializeService(): void {
    try {
      if (process.env.API_KEY) {
        this.realService = new RealService();
      } else {
        // TODO: Replace with real service integration
        logger.warn('Service running in mock mode');
      }
    } catch (error: any) {
      logger.error('Failed to initialize service:', error);
    }
  }

  async performOperation(): Promise<Result> {
    if (this.realService) {
      return await this.realService.performOperation();
    }

    // MOCK: Return development data
    logger.info('Operation running in mock mode');
    return { success: true, message: 'Mock operation completed' };
  }
}
```

### Configuration Pattern
```typescript
import { ConfigurationManager } from '../utils/config-manager';

const config = new ConfigurationManager();
const hederaConfig = await config.getHederaConfig();
```

## 🧪 Testing Strategy

### Development Mode (No API Keys)
All basic CLI commands should work:
```bash
apix --help                                    # ✅ Always works
apix analyze --directory .                     # ✅ Works with graceful degradation
apix health --quick                           # ✅ Works, shows mock mode status
apix recommend --industry pharmaceutical      # ✅ Works with rule-based fallbacks
```

### Production Mode (With API Keys)
Set environment variables for full functionality:
```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export HEDERA_ACCOUNT_ID=0.0.xxxxx
export HEDERA_PRIVATE_KEY=302e...

npm run validate:env  # Verify setup
apix validate --testnet  # Test real blockchain integration
```

## 🔄 AI Integration Status

### ✅ Working (Real AI)
- Enterprise classification with rule-based fallbacks
- Business intent detection
- Template selection and customization

### 🟡 Partial (Mock + Real)
- Code composition (basic templates work, advanced AI composition is mocked)
- Validation (health checks work, blockchain validation is mocked)
- Recommendations (rule-based works, AI-enhanced is mocked)

### 🔴 Mock Only
- Conversational interface (basic structure, AI responses mocked)
- Live blockchain validation (structure exists, Agent Kit integration mocked)
- Advanced compliance checking (frameworks exist, real validation mocked)

See `MOCK_DATA_AUDIT.md` for complete status and production readiness checklist.

## 🚀 Performance Considerations

- **Template Caching**: Handlebars templates are cached after first load
- **Progressive Enhancement**: 50% effort on core features, 30% on enhancement, 15% polish, 5% edge cases
- **Lazy Loading**: Heavy dependencies loaded only when needed
- **Mock Mode Performance**: Development mode optimized for speed over accuracy

## 🔐 Security & Compliance

### Environment Variables
Never commit these to repository:
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=302e...
HEDERA_NETWORK=testnet|mainnet
```

### Code Security
- All user inputs are validated
- No eval() or dynamic code execution
- Private keys never logged or exposed
- Compliance frameworks: FDA-21CFR11, SOX, GDPR support

## 📚 Documentation Standards

### File Headers
Include purpose and key integration points:
```typescript
// src/feature/awesome-feature.ts
// Purpose: Handles awesome feature functionality
// Dependencies: Hedera Agent Kit, LangChain OpenAI
// Mock Status: Partially mocked (see MOCK_DATA_AUDIT.md)
```

### TODO Comments
Be specific about what needs real implementation:
```typescript
// TODO: Replace with real HederaAgentKit integration
// MOCK: This returns static data for development
// Priority: High - Required for production blockchain validation
```

## 🔍 Debugging Tips

### Common Issues
1. **"Cannot find module 'hedera-agent-kit'"**: Expected during development, service falls back to mock
2. **TypeScript compilation errors**: Run `npm run build:check` to see all errors, fix systematically
3. **CLI commands not working**: Check if `npm run precommit` passes, ensure no compilation errors
4. **Mock vs real behavior confusion**: Check logs for "mock mode" messages

### Debug Commands
```bash
# See all TypeScript errors
npm run build:check

# Count and categorize errors
npm run build:check 2>&1 | grep "error TS" | wc -l

# Find mock implementations
npm run audit:mocks

# Check environment setup
npm run validate:env

# Get development health score
echo "Compilation errors: $(npm run build:check 2>&1 | grep 'error TS' | wc -l || echo '0')"
```

## 🎯 Immediate Priorities

### Before Making Changes
1. Ensure `npm run build:check` shows under 5 errors
2. Read `MOCK_DATA_AUDIT.md` to understand current mock status
3. Test basic CLI commands work: `npm run cli:help`

### When Adding Features
1. Follow graceful degradation pattern (works without API keys)
2. Document any new mocks in `MOCK_DATA_AUDIT.md`
3. Add clear TODO comments for future real implementations
4. Run `npm run precommit` before committing

### Production Readiness
Current development status: **70% complete**
- Core CLI: ✅ Complete
- Basic integrations: ✅ Complete
- Mock tracking: ✅ Complete
- AI integration: 🟡 60% complete
- Blockchain validation: 🔴 30% complete
- Enterprise features: 🟡 50% complete

---

## 📊 **PROJECT STATUS: Brief vs Implementation Analysis**

### **🎯 Overall Status: 75% Implementation Complete**

This section provides a critical assessment of what's actually implemented vs the original brief promises.

### **✅ FULLY IMPLEMENTED - Meeting Original Specifications**

#### **Core CLI Infrastructure**
- ✅ **15+ Commands**: All specified commands implemented (`analyze`, `add`, `generate`, `validate`, etc.)
- ✅ **TypeScript Foundation**: Complete CLI with Commander.js, error handling, progress tracking
- ✅ **Project Analysis**: Framework detection (Next.js, React, Express), dependency analysis
- ✅ **Configuration Management**: `.apix/config.json`, environment file generation
- ✅ **Template Engine**: Handlebars-based with conflict detection and framework adaptation

#### **Basic Hedera Integrations**
- ✅ **Core Commands Work**: `apix --help`, `apix analyze`, `apix health` all functional
- ✅ **Integration Detection**: Smart detection of existing Hedera integrations
- ✅ **File Generation**: Professional TypeScript/JavaScript file generation system
- ✅ **Framework Support**: Next.js (App Router + Pages Router), React, basic Express

### **🟡 PARTIALLY IMPLEMENTED - Core Works, Advanced Features Mocked**

#### **AI-Powered Features** (60% Complete)
- ✅ **Enterprise Classification**: Rule-based with LangChain integration ready
- ✅ **Business Intent Detection**: Working with fallbacks
- 🔴 **AI Code Composition**: Structure exists, but mocked responses
- 🔴 **Conversational Interface**: Chat command exists, but uses mock responses
- 🔴 **Advanced Recommendations**: Basic rule-based works, AI enhancement mocked

#### **Hedera Agent Kit Integration** (30% Complete)
- ✅ **Integration Structure**: Proper abstractions and interfaces
- ✅ **Graceful Degradation**: Works without credentials (development mode)
- 🔴 **Live Blockchain Validation**: Mocked - returns success without real validation
- 🔴 **Real Token Operations**: Framework exists, but no live blockchain interaction
- 🔴 **Transaction Signing**: Interface ready, but not connected to real wallets

### **🔴 CRITICAL GAPS - Core Promises Not Met**

#### **Missing Live Integration**
- ❌ **"90-Second Demo"**: Can't actually create and mint tokens live as promised in README
- ❌ **Working Hedera Agent Kit**: Uses mock implementation instead of real v3.2.0 integration
- ❌ **Live Blockchain Validation**: No actual testnet/mainnet validation happening
- ❌ **Real Wallet Connection**: No HashPack, Blade, or WalletConnect integration working

#### **Current Reality Check**
```bash
# ✅ These work and provide real value
apix --help                    # Full command listing
apix analyze --directory .     # Real project analysis
apix health --quick           # System health check
apix add hts --name MyToken   # Generates TypeScript files

# 🔴 These show "development mode" messages (mocked)
apix generate pharmaceutical-compliance  # Mock response
apix validate --testnet                 # Fake validation success
apix recommend --industry pharma        # Rule-based only, no AI
apix chat                               # Mock conversational responses
```

### **🚨 CRITICAL TECHNICAL DEBT**

#### **Compilation Status**
- **91 TypeScript compilation errors** - must be fixed before new features
- Run `npm run build:check` to see current error count
- Systematic type system fixes needed in enterprise types

#### **Mock Implementation Count**
- **28 mock implementations** documented in `MOCK_DATA_AUDIT.md`
- Core blockchain functionality is completely mocked
- AI responses are mostly placeholder text

### **📈 RECOMMENDED NEXT STEPS**

#### **Phase 1: Fix Foundation** (Priority: CRITICAL)
1. **Fix TypeScript Errors**: Get `npm run build:check` to 0 errors
2. **Real Hedera Agent Kit**: Connect to actual v3.2.0 package, not mock
3. **Basic Testnet Integration**: Make `apix validate --testnet` actually validate

#### **Phase 2: Core Live Features** (Priority: HIGH)
1. **Real Token Operations**: Live creation/minting on testnet
2. **Wallet Integration**: Working HashPack connection
3. **90-Second Demo**: Deliver the README promise of live token demo

#### **Phase 3: AI Enhancement** (Priority: MEDIUM)
1. **Real AI Responses**: Connect OpenAI/Anthropic APIs properly
2. **Advanced Code Composition**: Move beyond basic templates
3. **Enterprise Features**: Real compliance validation

### **⚠️ KEY INSIGHT FOR NEW SESSIONS**

**The codebase has excellent architecture and developer experience, but the core value proposition (live Hedera blockchain integration) is not functional.**

The CLI works beautifully and generates professional code, but it cannot:
- Create real tokens on Hedera testnet
- Connect to real wallets
- Perform live blockchain validation
- Deliver the "90-second demo" promised in README

**Start here**: Fix Hedera Agent Kit integration to enable real blockchain operations before adding new features.

---

## Quick Reference

| Command | Purpose | API Keys Required | **ACTUAL STATUS** |
|---------|---------|-------------------|-------------------|
| `apix analyze` | Project analysis | No | ✅ **Working** |
| `apix add <type>` | Add basic integration | No | ✅ **Working** |
| `apix generate <type>` | AI-powered generation | Yes (or mock) | 🔴 **Mocked** |
| `apix validate` | Blockchain validation | Yes (or mock) | 🔴 **Mocked** |
| `apix health` | System health check | No | ✅ **Working** |
| `apix recommend` | AI recommendations | No (rule-based) | 🟡 **Partial** |
| `apix chat` | Conversational interface | Yes (or mock) | 🔴 **Mocked** |

**Reality Check**: This codebase is designed for progressive enhancement, but currently most advanced features are mocked. The foundation is solid, but core blockchain functionality needs real implementation.