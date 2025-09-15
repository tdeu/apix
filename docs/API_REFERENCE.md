# 📚 APIX AI - API Reference

## Overview

APIX AI provides both CLI commands and programmatic APIs for enterprise integration. This reference covers all available commands, options, and programmatic interfaces.

---

## 🤖 Conversational Interface

### `apix chat`

Start an interactive AI conversation for enterprise Hedera development.

```bash
apix chat [options]
```

**Options:**
- `--session-file <file>` - Load previous conversation session
- `--industry <industry>` - Set initial industry context
- `--context <context>` - Provide initial business context (JSON string)
- `--verbose` - Enable detailed output
- `--debug` - Enable debug mode

**Examples:**
```bash
# Start basic chat
apix chat

# Resume previous session
apix chat --session-file apix-session-2024-01-15.json

# Start with industry context
apix chat --industry pharmaceutical

# Start with full business context
apix chat --context '{"industry":"financial-services","size":"enterprise","urgency":"high"}'
```

**Special Chat Commands:**
- `/help` - Show chat help
- `/save` - Save current session
- `/load <file>` - Load session file
- `/status` - Show session information
- `/limitations` - Explain AI capabilities
- `/preferences` - Update user preferences
- `/clear` - Clear screen
- `/exit` - End conversation

---

## 🏢 Enterprise AI Commands

### `apix generate`

Generate enterprise Hedera integration with AI-powered code composition.

```bash
apix generate <integration> [options]
```

**Integrations:**
- `supply-chain` - Supply chain traceability and compliance
- `payment-automation` - Automated payment and settlement systems
- `identity-management` - Digital identity and credential systems
- `asset-tokenization` - Real estate, commodities, IP tokenization
- `audit-compliance` - Regulatory compliance and audit trails

**Options:**
- `--industry <industry>` - Target industry context
- `--regulation <regulations...>` - Applicable regulations (FDA-21CFR11, SOX, GDPR, etc.)
- `--business-context <context>` - Business context description
- `--business-goals <goals...>` - Business objectives
- `--integration-type <type>` - Complexity level (simple, moderate, complex, novel)
- `--framework <framework>` - Target framework override
- `--custom-logic` - Enable AI custom logic generation
- `--validate-live` - Perform live Hedera blockchain validation
- `-f, --force` - Force overwrite existing files

**Examples:**
```bash
# Pharmaceutical supply chain with FDA compliance
apix generate supply-chain \
  --industry pharmaceutical \
  --regulation FDA-21CFR11 \
  --business-goals "compliance,traceability,automation"

# Financial payment system with SOX compliance
apix generate payment-automation \
  --industry financial-services \
  --regulation SOX \
  --integration-type complex \
  --validate-live

# Healthcare identity with HIPAA compliance
apix generate identity-management \
  --industry healthcare \
  --regulation HIPAA \
  --custom-logic \
  --framework nextjs
```

### `apix compose`

AI-powered custom code composition for novel requirements.

```bash
apix compose [options]
```

**Options:**
- `--requirements <requirements>` - Natural language requirement description
- `--industry <industry>` - Target industry context
- `--constraints <constraints...>` - Technical or business constraints
- `--templates <templates...>` - Base templates to combine
- `--novel-pattern` - Create entirely new implementation pattern
- `--validate-live` - Perform live Hedera validation

**Examples:**
```bash
# Custom carbon credit trading system
apix compose \
  --requirements "carbon credit trading with satellite verification and automated compliance reporting" \
  --industry environmental \
  --constraints "real-time-data,regulatory-compliance"

# Novel insurance automation
apix compose \
  --requirements "parametric insurance with weather data oracles" \
  --industry insurance \
  --novel-pattern \
  --validate-live
```

### `apix recommend`

AI-powered enterprise Hedera service recommendations.

```bash
apix recommend [options]
```

**Options:**
- `--business-goals <goals...>` - Business objectives
- `--industry <industry>` - Industry context
- `--current-systems <systems...>` - Existing systems to integrate
- `--regulations <regulations...>` - Regulatory requirements
- `--budget <budget>` - Budget constraints
- `--timeline <timeline>` - Implementation timeline
- `--interactive` - Interactive recommendation wizard

**Examples:**
```bash
# Get recommendations for financial services
apix recommend \
  --business-goals "compliance,automation,cost-reduction" \
  --industry financial-services \
  --regulations SOX,AML \
  --timeline "6-months"

# Interactive recommendation wizard
apix recommend --interactive
```

### `apix explain`

AI-powered explanations of Hedera concepts and enterprise patterns.

```bash
apix explain <concept> [options]
```

**Options:**
- `--industry <industry>` - Industry-specific explanation
- `--detailed` - Provide detailed technical explanation
- `--examples` - Include practical examples
- `--regulations` - Include regulatory considerations

**Examples:**
```bash
# Explain HTS vs smart contracts
apix explain "HTS vs smart contracts for loyalty points" --examples

# Industry-specific explanation
apix explain "consensus service for audit trails" \
  --industry pharmaceutical \
  --regulations \
  --detailed
```

### `apix compare`

AI-powered comparison of Hedera approaches for enterprise use cases.

```bash
apix compare <approaches> [options]
```

**Options:**
- `--use-case <usecase>` - Specific use case context
- `--industry <industry>` - Industry context
- `--criteria <criteria...>` - Comparison criteria (cost, performance, compliance, etc.)

**Examples:**
```bash
# Compare audit trail approaches
apix compare "HCS vs smart contracts for audit trails" \
  --industry healthcare \
  --criteria cost,performance,compliance

# Compare tokenization approaches
apix compare "HTS vs smart contracts for asset tokenization" \
  --use-case "real estate fractional ownership" \
  --criteria scalability,regulatory-compliance
```

### `apix confidence`

Assess AI confidence levels for specific requirements.

```bash
apix confidence <requirement> [options]
```

**Options:**
- `--industry <industry>` - Industry context
- `--complexity <complexity>` - Requirement complexity level
- `--detailed` - Show detailed confidence breakdown

**Examples:**
```bash
# Assess confidence for complex requirement
apix confidence "quantum-resistant cryptocurrency exchange" --detailed

# Industry-specific confidence assessment
apix confidence "FDA-compliant drug manufacturing system" \
  --industry pharmaceutical \
  --complexity expert
```

### `apix debug`

AI-powered debugging assistance for Hedera integration issues.

```bash
apix debug <issue> [options]
```

**Options:**
- `--context <context>` - Additional context about the issue
- `--files <files...>` - Related files to analyze
- `--logs <logfile>` - Log file to analyze
- `--suggest-fixes` - Provide fix suggestions

**Examples:**
```bash
# Debug smart contract issue
apix debug "Smart contract execution failed: gas estimation error" \
  --context "HTS token creation" \
  --suggest-fixes

# Debug with log analysis
apix debug "Transaction timeout error" \
  --logs ./hedera-error.log \
  --files src/lib/hedera-client.ts
```

---

## 🔍 Enhanced Traditional Commands

### `apix analyze`

Analyze project with AI insights and enterprise recommendations.

```bash
apix analyze [options]
```

**Options:**
- `-d, --directory <path>` - Project directory to analyze (default: .)
- `-v, --verbose` - Show detailed analysis
- `--enterprise` - Include enterprise compliance analysis
- `--security` - Include security assessment
- `--performance` - Include performance analysis

### `apix add`

Add Hedera integration with intelligent parameter generation.

```bash
apix add <integration> [options]
```

**Integrations:**
- `hts` - Hedera Token Service integration
- `wallet` - Wallet connectivity
- `contract` - Smart contract integration
- `consensus` - Consensus service integration
- `account` - Account management

**Options:**
- `-n, --name <name>` - Integration name
- `-s, --symbol <symbol>` - Token symbol (for HTS)
- `-p, --provider <provider>` - Wallet provider
- `-t, --type <type>` - Contract type
- `-f, --force` - Force overwrite existing files
- `--ai-enhance` - Use AI to enhance generated code
- `--enterprise` - Generate enterprise-grade implementation

### `apix validate`

Comprehensive validation with live Hedera blockchain testing.

```bash
apix validate [options]
```

**Options:**
- `--testnet` - Use Hedera testnet for validation
- `--mainnet` - Use Hedera mainnet for validation (production)
- `--enterprise` - Run enterprise-grade compliance validation
- `--compliance <frameworks...>` - Test specific compliance frameworks
- `--performance` - Include performance testing
- `--security` - Include security vulnerability scanning
- `--files <files...>` - Validate specific files
- `--ai-analysis` - Include AI code analysis

### `apix deploy`

Enterprise deployment with compliance checking and audit trails.

```bash
apix deploy [options]
```

**Options:**
- `--environment <env>` - Target environment (development, staging, production)
- `--compliance-check` - Run compliance validation before deployment
- `--audit-trail` - Enable deployment audit trail
- `--rollback-plan` - Generate rollback procedures
- `--monitoring` - Set up monitoring and alerts
- `--dry-run` - Simulate deployment without executing

---

## 🛠️ Programmatic API

### ConversationEngine

```typescript
import { ConversationEngine } from 'apix-ai';

const conversation = new ConversationEngine();

// Start session
const response = await conversation.startSession('session-id', {
  industry: 'pharmaceutical',
  companySize: 'enterprise'
});

// Process message
const aiResponse = await conversation.processMessage(
  'I need FDA-compliant drug tracking',
  'session-id'
);

// Save session
await conversation.saveSession('session-id', './session.json');
```

### AICodeCompositionEngine

```typescript
import { AICodeCompositionEngine } from 'apix-ai';

const composer = new AICodeCompositionEngine();

// Compose custom code
const result = await composer.composeCustomCode({
  description: 'Supply chain tracking with compliance',
  industry: 'pharmaceutical',
  businessContext: {
    complexity: 'moderate',
    regulations: ['FDA-21CFR11'],
    businessGoals: ['compliance', 'automation']
  }
}, {
  framework: 'nextjs',
  language: 'typescript'
});

console.log(result.code);
console.log(result.explanation);
```

### EnterpriseClassifier

```typescript
import { EnterpriseClassifier } from 'apix-ai';

const classifier = new EnterpriseClassifier();

// Classify requirement
const classification = await classifier.classifyRequirement(
  'Build pharmaceutical supply chain system',
  { industry: 'pharmaceutical' }
);

console.log(classification.recommendedServices);
console.log(classification.businessContext);
```

### SecurityManager

```typescript
import { SecurityManager } from 'apix-ai';

const security = new SecurityManager(securityConfig);

// Initialize security
await security.initialize();

// Validate code security
const validation = await security.validateCodeSecurity(
  generatedCode,
  { complianceFrameworks: ['SOC2', 'GDPR'] }
);

console.log(validation.securityScore);
console.log(validation.vulnerabilities);
```

### PerformanceOptimizer

```typescript
import { PerformanceOptimizer } from 'apix-ai';

const optimizer = new PerformanceOptimizer(performanceConfig);

// Get cached AI response
const result = await optimizer.getCachedAIResponse(
  'cache-key',
  () => expensiveAIOperation(),
  3600000 // 1 hour TTL
);

// Get performance metrics
const metrics = optimizer.getPerformanceMetrics();
console.log(metrics.cacheHitRatio);
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Hedera Configuration
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=302e...
HEDERA_NETWORK=testnet

# AI Configuration
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEFAULT_LLM=gpt-4o-mini

# Security Configuration
ENCRYPTION_KEY=your-256-bit-key
AUDIT_ENABLED=true
SECURITY_LEVEL=enterprise

# Performance Configuration
CACHE_ENABLED=true
PERFORMANCE_MONITORING=true
AUTO_OPTIMIZATION=true
```

### Configuration File (.apixrc.json)

```json
{
  "version": "2.0.0",
  "ai": {
    "defaultModel": "gpt-4o-mini",
    "compositionEnabled": true,
    "limitationAssessment": true,
    "transparentCommunication": true
  },
  "enterprise": {
    "securityLevel": "enterprise",
    "complianceFrameworks": ["SOC2", "GDPR", "HIPAA"],
    "auditEnabled": true,
    "encryptionEnabled": true
  },
  "performance": {
    "cachingEnabled": true,
    "batchingEnabled": true,
    "optimizationEnabled": true,
    "monitoringEnabled": true
  },
  "templates": {
    "enterpriseVariants": true,
    "customLogic": true,
    "validation": "live"
  }
}
```

---

## 📊 Response Formats

### Standard Response Format

```json
{
  "success": true,
  "data": {
    "generatedFiles": [
      {
        "path": "src/lib/hedera/hts-operations.ts",
        "content": "...",
        "type": "typescript"
      }
    ],
    "installedDependencies": ["@hashgraph/sdk"],
    "nextSteps": [
      "Configure environment variables",
      "Run npm install",
      "Test integration"
    ]
  },
  "metadata": {
    "duration": 2340,
    "aiConfidence": 0.89,
    "complianceStatus": "validated",
    "securityScore": 95
  }
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Security validation failed",
    "details": {
      "vulnerabilities": [
        {
          "severity": "high",
          "description": "Hardcoded secrets detected",
          "location": "line 45"
        }
      ]
    },
    "recovery": {
      "suggestions": [
        "Move secrets to environment variables",
        "Use secure key management"
      ],
      "fallbackOptions": [
        "Use template-based approach",
        "Consult security expert"
      ]
    }
  }
}
```

---

## 🔄 Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Configuration error |
| 4 | Network/API error |
| 5 | Validation failed |
| 6 | Security violation |
| 7 | Performance threshold exceeded |
| 8 | AI service unavailable |
| 9 | Hedera network error |
| 10 | Compliance violation |

---

## 🎯 Best Practices

### Effective AI Conversations
1. **Be Specific** - Provide clear business context and requirements
2. **Mention Constraints** - Include regulatory, technical, or budget constraints
3. **Ask Follow-ups** - Refine requirements through conversation
4. **Verify Understanding** - Confirm AI interpretation before generation

### Enterprise Security
1. **Use Environment Variables** - Never hardcode secrets
2. **Enable Audit Logging** - Track all operations for compliance
3. **Regular Security Scans** - Use `--security` flags
4. **Compliance Validation** - Always validate against required frameworks

### Performance Optimization
1. **Enable Caching** - Use caching for repeated operations
2. **Monitor Metrics** - Track performance and optimization
3. **Batch Operations** - Group related operations together
4. **Resource Management** - Configure appropriate limits

---

## 🚨 Troubleshooting

### Common Issues

**AI Service Unavailable**
```bash
# Check API keys
apix debug "AI service connection failed" --suggest-fixes

# Verify configuration
apix status --verbose
```

**Hedera Network Errors**
```bash
# Validate network configuration
apix validate --testnet --debug

# Check account credentials
apix debug "Transaction failed" --context "network-connectivity"
```

**Performance Issues**
```bash
# Check performance metrics
apix status --performance

# Optimize resources
apix optimize --auto
```

### Getting Help

```bash
# AI-powered assistance
apix chat
💬 "I'm having issues with [describe your problem]"

# Command-specific help
apix <command> --help

# Debug with AI assistance
apix debug "your specific error message" --suggest-fixes
```

---

*For more detailed information, see our [Enterprise Deployment Guide](DEPLOYMENT_GUIDE.md) and [Technical Architecture](TECHNICAL_ARCHITECTURE.md).*