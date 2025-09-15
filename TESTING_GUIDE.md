# 🧪 APIX AI - Testing Guide

## Quick Test Overview

Since we've implemented all the components but they're not yet compiled/built, here are the testing approaches:

---

## 🚀 Option 1: Quick Component Testing (Recommended)

### Step 1: Build the Project
```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Verify build
ls dist/
```

### Step 2: Test Individual Components
```bash
# Test CLI core functionality
node dist/cli/index.js --help

# Test chat interface (if build succeeds)
node dist/cli/index.js chat --help

# Test basic commands
node dist/cli/index.js analyze --help
node dist/cli/index.js health --quick
```

---

## 🔧 Option 2: Component Unit Testing

### Create Test Files
```bash
mkdir -p test/unit
```

### Test Conversation Engine
```typescript
// test/unit/conversation-engine.test.ts
import { ConversationEngine } from '../../src/ai/conversation/conversation-engine';

describe('ConversationEngine', () => {
  let engine: ConversationEngine;

  beforeEach(() => {
    engine = new ConversationEngine();
  });

  test('should start a session', async () => {
    const response = await engine.startSession('test-session', {
      industry: 'pharmaceutical'
    });
    
    expect(response.content).toBeDefined();
    expect(response.suggestions).toBeDefined();
    expect(response.sessionId).toBe('test-session');
  });

  test('should process messages', async () => {
    await engine.startSession('test-session');
    
    const response = await engine.processMessage(
      'I need pharmaceutical compliance',
      'test-session'
    );
    
    expect(response.content).toBeDefined();
    expect(response.confidence).toBeGreaterThan(0);
  });
});
```

### Test Enterprise Classifier
```typescript
// test/unit/enterprise-classifier.test.ts
import { EnterpriseClassifier } from '../../src/ai/classifiers/enterprise-classifier';

describe('EnterpriseClassifier', () => {
  let classifier: EnterpriseClassifier;

  beforeEach(() => {
    classifier = new EnterpriseClassifier();
  });

  test('should classify pharmaceutical requirements', async () => {
    const result = await classifier.classifyRequirement(
      'FDA-compliant drug tracking system'
    );
    
    expect(result.businessContext?.industry).toBe('pharmaceutical');
    expect(result.recommendedServices).toContain('HCS');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test('should identify regulations', async () => {
    const result = await classifier.classifyRequirement(
      'HIPAA-compliant patient records',
      { industry: 'healthcare' }
    );
    
    expect(result.businessContext?.regulations).toContain('HIPAA');
  });
});
```

### Run Unit Tests
```bash
npm test
```

---

## 🎯 Option 3: Integration Testing

### Test with Mock Environment
```bash
# Create test environment
cp .env.example .env.test

# Add test credentials
cat >> .env.test << EOF
# Test Configuration
NODE_ENV=test
HEDERA_ACCOUNT_ID=0.0.12345
HEDERA_PRIVATE_KEY=test-key
HEDERA_NETWORK=testnet
OPENAI_API_KEY=test-openai-key
DEFAULT_LLM=gpt-4o-mini
EOF
```

### Test CLI Integration
```typescript
// test/integration/cli.test.ts
import { execSync } from 'child_process';

describe('CLI Integration', () => {
  test('should show help', () => {
    const output = execSync('node dist/cli/index.js --help', { encoding: 'utf8' });
    expect(output).toContain('APIX AI');
    expect(output).toContain('chat');
    expect(output).toContain('generate');
  });

  test('should analyze project', () => {
    const output = execSync('node dist/cli/index.js analyze --directory .', { encoding: 'utf8' });
    expect(output).toContain('Project Analysis');
  });
});
```

---

## 🧠 Option 4: AI Component Testing

### Test with Mock AI Responses
```typescript
// test/mocks/ai-mock.ts
export class MockLLM {
  async invoke(messages: any[]): Promise<{ content: string }> {
    const input = messages[messages.length - 1].content || '';
    
    if (input.includes('pharmaceutical')) {
      return {
        content: JSON.stringify({
          industry: 'pharmaceutical',
          regulations: ['FDA-21CFR11'],
          services: ['HCS', 'HTS'],
          confidence: 0.9
        })
      };
    }
    
    return { content: 'Mock AI response' };
  }
}
```

### Test AI Code Composition
```typescript
// test/unit/code-composition.test.ts
import { AICodeCompositionEngine } from '../../src/ai/composition/ai-code-composition-engine';

describe('AICodeCompositionEngine', () => {
  test('should compose custom code', async () => {
    const engine = new AICodeCompositionEngine();
    
    const result = await engine.composeCustomCode({
      description: 'Simple HTS token system',
      industry: 'technology',
      businessContext: {
        complexity: 'moderate',
        regulations: [],
        businessGoals: ['automation']
      }
    }, {
      framework: 'nextjs',
      language: 'typescript'
    });
    
    expect(result.code).toBeDefined();
    expect(result.explanation).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });
});
```

---

## 🔒 Option 5: Security Testing

### Test Security Framework
```typescript
// test/unit/security.test.ts
import { SecurityManager } from '../../src/security/security-manager';

describe('SecurityManager', () => {
  let security: SecurityManager;

  beforeEach(() => {
    security = new SecurityManager({
      encryptionConfig: { enabled: true, algorithm: 'aes-256-gcm', keySize: 256, keyRotation: { enabled: false, frequency: 90, automatic: false, gracePeriod: 7 }, keyStorage: 'env', saltLength: 16 },
      accessConfig: { enabled: true, authentication: { methods: [], passwordPolicy: { minLength: 8, complexity: true, history: 5, expiration: 90, lockout: { enabled: true, attempts: 5, duration: 300, progressive: false } }, lockoutPolicy: { enabled: true, attempts: 5, duration: 300, progressive: false }, sessionTimeout: 3600 }, authorization: { model: 'RBAC', defaultDeny: true, principleOfLeastPrivilege: true, segregationOfDuties: true }, roleBasedAccess: { roles: [], permissions: [], hierarchical: false, inheritance: false }, sessionManagement: { timeout: 3600, renewalRequired: true, concurrentSessions: 1, secureFlag: true, sameSite: 'strict' }, multiFactorAuth: { enabled: false, required: false, methods: [], backupCodes: false, rememberDevice: false } },
      auditConfig: { enabled: true, logLevel: 'info', destinations: [], retention: { dataType: 'audit', retentionPeriod: '7y', disposalMethod: 'secure-delete', legalBasis: 'compliance' }, encryption: true, realTimeMonitoring: true, alerting: { enabled: true, channels: [], rules: [], escalation: { levels: [], timeout: 300, repeat: false } } },
      codeSecurityConfig: { enabled: true, staticAnalysis: { enabled: true, tools: [], rules: [], excludePatterns: [], failOnHigh: true }, dependencyScanning: { enabled: true, sources: [], autoUpdate: false, allowedLicenses: [], blockedPackages: [] }, secretsManagement: { enabled: true, detector: 'default', patterns: [], excludeFiles: [], failOnDetection: true }, codeInjectionPrevention: { enabled: true, techniques: [], validation: true, sanitization: true, encoding: true }, vulnerabilityScanning: { enabled: true, databases: [], updateFrequency: 'daily', severity: [], autoRemediation: false } },
      complianceConfig: { frameworks: [], gdprCompliance: { enabled: false, dataProcessingBasis: [], consentManagement: false, rightToErasure: false, dataPortability: false, privacyByDesign: false }, soc2Compliance: { enabled: false, trustServices: [], controls: [], auditFrequency: 'annual' }, hipaaCompliance: { enabled: false, coveredEntity: false, businessAssociate: false, safeguards: [], breachNotification: false }, isoCompliance: { enabled: false, standard: '27001', controls: [], riskAssessment: false }, customCompliance: [] },
      securityLevel: 'enterprise'
    });
  });

  test('should validate code security', async () => {
    const testCode = `
      const password = "hardcoded-secret";
      function processData(input) {
        return eval(input);
      }
    `;
    
    const result = await security.validateCodeSecurity(testCode, {});
    
    expect(result.vulnerabilities.length).toBeGreaterThan(0);
    expect(result.securityScore).toBeLessThan(100);
  });
});
```

---

## 🎬 Option 6: Demo Testing

### Create Demo Test Script
```bash
#!/bin/bash
# demo-test.sh

echo "🎬 Testing APIX AI Demo Scenario"

# Test 1: Basic CLI functionality
echo "Test 1: CLI Help"
node dist/cli/index.js --help

# Test 2: Project analysis
echo "Test 2: Project Analysis"
node dist/cli/index.js analyze --directory . --verbose

# Test 3: Health check
echo "Test 3: Health Check"
node dist/cli/index.js health --quick

# Test 4: Chat interface (if working)
echo "Test 4: Chat Interface"
echo "exit" | node dist/cli/index.js chat

echo "✅ Demo tests completed"
```

```bash
chmod +x demo-test.sh
./demo-test.sh
```

---

## 🚀 Option 7: Comprehensive Test Suite

### Run the Built-in Test Suite
```bash
# Run all tests
npm run test

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:security
npm run test:performance
```

### Manual Testing Checklist
```
✅ Core Functionality:
  [ ] CLI commands execute without errors
  [ ] Help messages display correctly
  [ ] Configuration loads properly
  [ ] Environment variables recognized

✅ AI Components:
  [ ] ConversationEngine initializes
  [ ] EnterpriseClassifier works with mock data
  [ ] LimitationHandler assesses capabilities
  [ ] ErrorRecoverySystem handles errors

✅ Security:
  [ ] SecurityManager initializes
  [ ] Code scanning detects vulnerabilities
  [ ] Encryption/decryption works
  [ ] Audit logging functions

✅ Performance:
  [ ] PerformanceOptimizer starts
  [ ] Caching mechanisms work
  [ ] Memory usage acceptable
  [ ] Response times meet targets
```

---

## 🛠️ Option 8: Development Testing

### Test Individual Files
```bash
# Test specific TypeScript files
npx ts-node src/ai/conversation/conversation-engine.ts
npx ts-node src/ai/classifiers/enterprise-classifier.ts
npx ts-node src/security/security-manager.ts
```

### Interactive Testing
```bash
# Start Node REPL with TypeScript
npx ts-node

# Then test components interactively:
> import { ConversationEngine } from './src/ai/conversation/conversation-engine'
> const engine = new ConversationEngine()
> // Test various methods
```

---

## 🔍 Debugging & Troubleshooting

### Common Issues and Solutions

**Build Errors:**
```bash
# Check TypeScript compilation
npx tsc --noEmit

# Fix import issues
npm install --save-dev @types/node

# Check dependencies
npm audit
npm install
```

**Runtime Errors:**
```bash
# Enable debug logging
DEBUG=apix:* npm test

# Check environment variables
printenv | grep -E "(HEDERA|OPENAI|ANTHROPIC)"

# Validate configuration
node -e "console.log(require('./dist/utils/config-manager').default)"
```

**AI Service Issues:**
```bash
# Test API connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models

# Test with mock responses
MOCK_AI_RESPONSES=true npm test
```

---

## 📊 Testing Strategy Recommendation

### For Quick Validation (5 minutes):
1. ✅ Build the project (`npm run build`)
2. ✅ Test CLI help (`node dist/cli/index.js --help`)
3. ✅ Run unit tests (`npm test`)

### For Demo Preparation (15 minutes):
1. ✅ Run demo test script
2. ✅ Test chat interface with mock data
3. ✅ Verify all CLI commands work
4. ✅ Test error handling

### For Production Readiness (1 hour):
1. ✅ Full test suite
2. ✅ Security validation
3. ✅ Performance testing
4. ✅ Integration testing
5. ✅ Load testing

---

**🎯 Start with Option 1 (Quick Component Testing) - it's the fastest way to validate that our implementation works!**