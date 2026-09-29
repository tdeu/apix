# APIX Testing & Real Blockchain Operations Guide

## Overview

APIX AI executes real blockchain operations on Hedera. All commands that interact with the blockchain require valid Hedera credentials.

APIX supports two operational modes:

1. **Production Mode** - Full Hedera blockchain integration with real transactions (testnet or mainnet)
2. **Partial Mode** - Limited features when some credentials are missing (non-blockchain operations only)

This guide explains credential requirements and how to set up for real blockchain operations.

---

## Operational Modes

### 🟢 Production Mode

**When Active:**
- All Hedera credentials are configured (`HEDERA_ACCOUNT_ID`, `HEDERA_PRIVATE_KEY`)
- AI API keys are available (when needed)
- Commands execute real blockchain operations

**Characteristics:**
- ✅ Real token creation on Hedera Testnet/Mainnet
- ✅ Actual HBAR costs (minimal on testnet)
- ✅ Transactions visible on HashScan explorer
- ✅ Full HederaAgentKit integration
- ⚡ Live blockchain validation

**Setup:**
```bash
# 1. Copy environment template
cp .env.example .env

# 2. Add your Hedera credentials
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
HEDERA_NETWORK=testnet

# 3. Add AI API keys (for enterprise features)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# 4. Verify setup
apix health --quick
```

**Getting Testnet Credentials:**
1. Visit [Hedera Portal](https://portal.hedera.com/)
2. Create a testnet account
3. Get free testnet HBAR from [Hedera Faucet](https://portal.hedera.com/faucet)

---

**Getting Testnet Credentials:**
For development and testing, use Hedera testnet which provides free HBAR:

1. Visit [Hedera Portal](https://portal.hedera.com/)
2. Create a testnet account (free)
3. Get free testnet HBAR from [Hedera Faucet](https://portal.hedera.com/faucet)
4. Copy your account ID and private key to `.env` file

**Testnet vs Mainnet:**
- **Testnet**: Free HBAR, perfect for development and testing
- **Mainnet**: Production network with real HBAR costs (use with caution)

---

### 🔵 Partial Mode

**When Active:**
- Some credentials are configured but not all
- Hedera credentials exist but AI keys missing
- OR vice versa

**Characteristics:**
- ✅ Basic operations work
- ⚠️ Advanced AI features disabled
- ⚠️ Some commands show warnings

**Visual Indicators:**
```
ℹ️  PARTIAL MODE
Some features limited. Add credentials for full functionality.

⚠️  Warnings:
   OPENAI_API_KEY not set - AI composition features disabled

Commands will use available capabilities.
```

---

## Command-Specific Behavior

### Token Creation

**Requirements:** Valid Hedera credentials (HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY)

| Network | Cost | Result |
|---------|------|--------|
| Testnet | ~$0.01 HBAR (free from faucet) | Real token on Hedera testnet |
| Mainnet | ~$0.01 HBAR (~$0.0005 USD) | Real token on Hedera mainnet |

**Example Output:**
```bash
apix create-token --name "ProductionToken" --symbol "PROD"

✨ Token Created Successfully!
   Name: ProductionToken
   Symbol: PROD
   Token ID: 0.0.4923456
   Decimals: 8
   Initial Supply: 1,000,000
   Network: testnet
   Transaction ID: 0.0.4912345@1699564832.123456789

   🔗 View on HashScan:
   https://hashscan.io/testnet/token/0.0.4923456
```

### Project Analysis

**Requirements:** None - works without any credentials

**Behavior:** Analyzes project structure, detects frameworks, suggests Hedera integrations

### Code Generation

**Requirements:** None - works without any credentials

**Behavior:** Generates integration code and templates for your project

### Health Check

**Requirements:** Optional - works with or without credentials

**Behavior:**
- With credentials: Tests real Hedera connectivity
- Without credentials: Reports missing configuration

---

## Environment Validation

APIX automatically validates your environment before critical operations:

```bash
apix create-token --name "Test" --symbol "TST"

🔍 Environment Configuration:

   HEDERA_ACCOUNT_ID     ❌ Missing
   HEDERA_PRIVATE_KEY    ❌ Missing
   HEDERA_NETWORK        testnet (default)
   OPENAI_API_KEY        ❌ Missing
   ANTHROPIC_API_KEY     ❌ Missing
   GROQ_API_KEY          ❌ Missing

⚠️  SIMULATION MODE
Real blockchain operations disabled. Using mock responses.

📝 Next Steps:
   1. Copy .env.example to .env
   2. Add your credentials to .env
   3. Run the command again
```

---

## Setting Up Credentials

### Initial Setup

```bash
# 1. Create .env file
cp .env.example .env

# 2. Edit .env and add your Hedera credentials
vim .env

# Add these lines:
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
HEDERA_NETWORK=testnet

# 3. Verify credentials
apix health --quick

# 4. Start creating real tokens
apix create-token --name "MyToken" --symbol "MTK"
```

### Switching Networks

```bash
# Development (testnet - free HBAR)
HEDERA_NETWORK=testnet

# Production (mainnet - real HBAR costs)
HEDERA_NETWORK=mainnet
```

---

## Best Practices

### Development & Testing Phase
✅ Use **Testnet** for:
- Initial learning and exploration
- Testing CLI commands and blockchain operations
- Integration testing with real transactions
- Wallet connection testing
- End-to-end workflows
- CI/CD pipelines (with testnet credentials)
- Pre-deployment validation

**Advantages:**
- Free HBAR from faucet
- Real blockchain behavior
- Safe to experiment
- Identical to mainnet behavior

### Production Phase
✅ Use **Mainnet** for:
- Live applications
- Real user transactions
- Production deployments

**Important:**
- Real HBAR costs apply
- Test thoroughly on testnet first
- Monitor transaction costs
- Implement proper error handling

---

## Troubleshooting

### "I don't have credentials, can I still use APIX?"

Yes! Non-blockchain commands work without credentials:
- `apix analyze` - Project analysis
- `apix add hts` - Code generation
- `apix health` - System check

Blockchain operations (`create-token`, etc.) require valid Hedera credentials.

### "My commands fail with 'credentials not found'"

To fix:
1. Create `.env` file: `cp .env.example .env`
2. Get testnet account from [Hedera Portal](https://portal.hedera.com/)
3. Add credentials to `.env` file
4. Run `apix health --quick` to verify
5. Try the command again

### "How do I verify my credentials are working?"

```bash
apix health --quick
```

This will test your Hedera connection and show any configuration issues.

### "Can I test without spending real money?"

Yes! Use testnet credentials - get free HBAR from [Hedera Faucet](https://portal.hedera.com/faucet). All operations on testnet are free.

---

## Cost Comparison

| Operation | Testnet | Mainnet (USD equivalent) |
|-----------|---------|--------------------------|
| Token Creation | ~$0.01 HBAR (FREE) | ~$0.01 HBAR (~$0.0005) |
| Token Transfer | ~$0.0001 HBAR (FREE) | ~$0.0001 HBAR (~$0.000005) |
| Topic Creation | ~$0.01 HBAR (FREE) | ~$0.01 HBAR (~$0.0005) |
| Smart Contract Deploy | ~$0.02-0.05 HBAR (FREE) | ~$0.02-0.05 HBAR (~$0.001-0.0025) |

**All testnet HBAR is FREE from [Hedera Faucet](https://portal.hedera.com/faucet)!**

Testnet provides unlimited free transactions - perfect for development and testing.

---

## FAQ

**Q: Is the generated code production-ready?**
A: Yes! APIX generates production-ready code that works on both testnet and mainnet.

**Q: How do I get testnet HBAR?**
A: Visit [Hedera Faucet](https://portal.hedera.com/faucet) and enter your testnet account ID. You'll receive free testnet HBAR instantly.

**Q: What's the difference between testnet and mainnet?**
A: Testnet uses free HBAR for testing. Mainnet uses real HBAR for production. Both networks behave identically - testnet is perfect for development.

**Q: Can I use mainnet credentials with APIX?**
A: Yes! Set `HEDERA_NETWORK=mainnet` in .env. Be cautious - mainnet operations cost real HBAR.

**Q: Do blockchain operations work without credentials?**
A: No. All blockchain operations require valid Hedera credentials. However, code generation and project analysis work without credentials.

---

## Related Documentation

- [Environment Configuration Guide](./ENVIRONMENT_CONFIG.md)
- [Hedera Integration Guide](./HEDERA_INTEGRATION_GUIDE.md)
- [Testing Guide](./TESTING_GUIDE.md)
- [API Reference](./API_REFERENCE.md)
