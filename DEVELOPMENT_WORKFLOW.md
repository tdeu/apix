# APIX AI - Development Workflow & Compilation Check Guidelines

## 🚀 Quick Start

### 1. Initial Setup
```bash
# Clone and install
git clone <repository>
cd apix
npm install
```

### 2. Check Current Status
```bash
# Check compilation
npm run build:check

# Audit mock implementations
npm run audit:mocks

# Validate environment
npm run validate:env

# Test basic CLI
npm run cli:help
```

---

## 🔧 Development Workflow

### Before Starting Any Feature

1. **Check compilation status**
   ```bash
   npm run build:check
   ```

2. **Run mock audit**
   ```bash
   npm run audit:mocks
   ```

3. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

### During Development

1. **After each significant change**
   ```bash
   npm run build:check  # Must pass!
   npm run lint         # Fix any issues
   ```

2. **Test your changes**
   ```bash
   npm run cli:help     # Basic CLI works
   npm run cli:health   # Health check works
   npm run cli:analyze  # Project analysis works
   ```

3. **Check for new mocks**
   ```bash
   npm run audit:mocks  # Document any new mock implementations
   ```

### Before Committing

1. **Mandatory checks** (automated in `precommit`)
   ```bash
   npm run precommit    # Runs build:check + lint
   ```

2. **Manual verification**
   ```bash
   npm run audit:mocks  # Update MOCK_DATA_AUDIT.md if needed
   npm test            # All tests pass
   ```

3. **Update documentation**
   - Add any new mock implementations to `MOCK_DATA_AUDIT.md`
   - Update TODO comments with clear descriptions
   - Document environment variables needed

---

## 📋 Compilation Check Protocol

### ✅ Zero Tolerance Policy
- **NO commits allowed** with TypeScript compilation errors
- **ALL features must compile** before PR creation
- **Mock implementations must be documented** in audit file

### 🔍 Error Monitoring Commands

```bash
# Basic compilation check
npm run build:check

# Strict mode (catches more issues)
npm run build:strict

# Get error count
npm run build:check 2>&1 | grep "error TS" | wc -l

# See specific errors by file
npm run build:check 2>&1 | grep "error TS" | cut -d'(' -f1 | sort | uniq -c | sort -nr
```

### 🚨 If Compilation Fails

1. **Fix immediately** - don't continue with new features
2. **Identify root cause** - type issues, missing imports, etc.
3. **Test the fix** - ensure error count decreases
4. **Document any mocks** - if you add temporary implementations

---

## 🧪 Testing Strategy

### Development Mode (No API Keys)
```bash
# Test CLI without credentials
npm run cli:help
npm run cli:health
npm run cli:analyze

# Should work with graceful degradation
npx ts-node src/cli/index.ts recommend --industry pharmaceutical
```

### Production Mode (With API Keys)
```bash
# Set environment variables
export OPENAI_API_KEY=your_key
export ANTHROPIC_API_KEY=your_key
export HEDERA_ACCOUNT_ID=0.0.xxxxx
export HEDERA_PRIVATE_KEY=your_key

# Validate environment
npm run validate:env

# Test real functionality
npx ts-node src/cli/index.ts validate --testnet
npx ts-node src/cli/index.ts generate pharmaceutical-compliance
```

---

## 📊 Current Status Monitoring

### Get Development Health Score
```bash
# Quick status check
echo "=== APIX AI Development Status ==="
echo "Compilation errors: $(npm run build:check 2>&1 | grep 'error TS' | wc -l || echo '0')"
echo "Mock implementations: $(npm run audit:mocks 2>/dev/null | grep '🔴 Mock implementations found:' | awk '{print $NF}' || echo 'Unknown')"
echo "TODO items: $(npm run audit:mocks 2>/dev/null | grep '🟡 TODO items found:' | awk '{print $NF}' || echo 'Unknown')"
```

### Files to Monitor Closely
- `src/cli/cli-core.ts` - Core CLI functionality
- `src/ai/classifiers/enterprise-classifier.ts` - AI classification
- `src/validation/agent-kit/hedera-agent-kit-validator.ts` - Blockchain validation
- `src/ai/composition/ai-code-composition-engine.ts` - AI code generation

---

## 🎯 Production Readiness Checklist

### Phase 1: Core Functionality (Current)
- [x] CLI infrastructure complete
- [x] Basic commands working
- [x] Mock fallbacks implemented
- [x] Compilation clean (under 5 errors)
- [ ] Real Hedera Agent Kit integration
- [ ] AI API integration working

### Phase 2: Feature Complete
- [ ] All mock implementations replaced
- [ ] Comprehensive testing with real APIs
- [ ] Error handling verified
- [ ] Performance optimization complete

### Phase 3: Production Ready
- [ ] Security audit complete
- [ ] Documentation finalized
- [ ] CI/CD pipeline established
- [ ] Monitoring and logging implemented

---

## 🔄 Continuous Integration

### GitHub Actions (Recommended)
```yaml
# .github/workflows/compile-check.yml
name: TypeScript Compilation Check
on: [push, pull_request]
jobs:
  compile-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build:check
      - run: npm run lint
      - run: npm run audit:mocks
```

### Pre-commit Hooks (Optional)
```bash
# Install husky for git hooks
npm install --save-dev husky
npx husky init
echo "npm run precommit" > .husky/pre-commit
```

---

## 📝 Documentation Requirements

### When Adding Mock Implementations
1. **Add clear TODO comments**
   ```typescript
   // TODO: Replace with real HederaAgentKit integration
   // MOCK: This returns static data for development
   ```

2. **Update MOCK_DATA_AUDIT.md**
   - Add entry with file location
   - Describe what needs real implementation
   - Estimate effort required

3. **Log mock mode usage**
   ```typescript
   logger.info('Feature running in mock mode', { feature: 'hedera-validation' });
   ```

### Environment Variables
Document all required environment variables in:
- `.env.example`
- `MOCK_DATA_AUDIT.md`
- Function-level comments where used

---

## 🆘 Troubleshooting

### Common Issues

1. **Compilation errors after merge**
   ```bash
   npm run build:check  # See specific errors
   # Fix type issues, missing imports, etc.
   ```

2. **High mock implementation count**
   ```bash
   npm run audit:mocks  # Review all mocks
   # Prioritize based on MOCK_DATA_AUDIT.md
   ```

3. **Environment setup issues**
   ```bash
   npm run validate:env  # Check what's missing
   cp .env.example .env  # Set up environment file
   ```

4. **CLI not working**
   ```bash
   npm run cli:help     # Should always work
   # Check for compilation errors first
   ```

---

## 📞 Developer Notes

- **Mock implementations are temporary** - they exist for development velocity
- **All mocks must be documented** - so we can find and replace them
- **Graceful degradation is key** - users should get value even without full setup
- **Compilation must be clean** - no exceptions for technical debt
- **Environment flexibility** - works with or without API keys during development