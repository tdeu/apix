# 🚀 Hedera Integration Guide

This guide explains how to use APIX with real Hedera blockchain operations.

## 🎯 Current Status: WORKING!

✅ **Simulation Mode**: Works out-of-the-box with test accounts
✅ **Real Blockchain Mode**: Works with your Hedera testnet/mainnet credentials
✅ **Live Validation**: Real network connection testing
✅ **Token Operations**: Create actual tokens on Hedera network

## 🧪 Quick Test (Simulation Mode)

No setup required - works immediately:

```bash
# Test token creation (simulation)
npm run apix:create-token

# Test blockchain validation
npx ts-node src/cli/index.ts validate --testnet

# Test integration generation with optional token creation
npx ts-node src/cli/index.ts add hts --name "MyToken" --symbol "MTK"
```

## 🔥 Real Blockchain Operations

### Step 1: Get Hedera Testnet Credentials

1. Visit [Hedera Portal](https://portal.hedera.com/)
2. Create testnet account
3. Get your Account ID (format: `0.0.xxxxx`)
4. Get your Private Key (format: `302e020100...`)

### Step 2: Set Environment Variables

```bash
# Set in your terminal or .env file
export HEDERA_ACCOUNT_ID="0.0.xxxxx"
export HEDERA_PRIVATE_KEY="302e020100300506032b657004220420..."
export HEDERA_NETWORK="testnet"

# Verify setup
npm run validate:env
```

### Step 3: Test Real Operations

```bash
# Create real token on Hedera testnet
npx ts-node src/cli/index.ts create-token --name "RealToken" --symbol "REAL" --supply 100000

# Validate real network connection
npx ts-node src/cli/index.ts validate --testnet --performance

# Generate integration with real token creation option
npx ts-node src/cli/index.ts add hts --name "ProductToken" --symbol "PROD"
```

## 📋 Available Commands

### Token Operations
```bash
# Basic token creation
apix create-token --name "MyToken" --symbol "MTK"

# Advanced token creation
apix create-token --name "ComplexToken" --symbol "CTK" --supply 1000000 --decimals 18 --admin-key --supply-key
```

### Validation & Testing
```bash
# Basic network validation
apix validate --testnet

# Comprehensive validation
apix validate --testnet --enterprise --performance

# Quick health check
apix health --quick
```

### Integration Generation
```bash
# HTS integration with optional real token
apix add hts --name "ProjectToken" --symbol "PROJ"

# Other integrations (templates only for now)
apix add wallet --provider hashpack
apix add smart-contract --type marketplace
```

## 🎛️ Mode Detection

APIX automatically detects your setup:

| Environment | Mode | Behavior |
|-------------|------|----------|
| No credentials | **Simulation** | Uses test accounts, simulates operations |
| Test credentials | **Live Testnet** | Real operations on Hedera testnet |
| Main credentials | **Live Mainnet** | Real operations on Hedera mainnet |

## 🚨 Important Notes

### Development vs Production
- **Testnet**: Free testing, use for development
- **Mainnet**: Real transactions with costs, production only

### Credentials Security
- Never commit private keys to git
- Use environment variables or `.env` files
- Keep mainnet credentials secure

### Token Creation Costs
- **Testnet**: Free with testnet HBAR
- **Mainnet**: ~$30 HBAR per token creation

## 🔧 Troubleshooting

### "Insufficient Balance" Error
```bash
# Check your account balance
npx ts-node src/cli/index.ts validate --testnet

# Get testnet HBAR from faucet
# Visit: https://portal.hedera.com/faucet
```

### "Network Connection Failed"
```bash
# Verify credentials
npm run validate:env

# Test basic connection
npx ts-node src/cli/index.ts health --quick

# Check network status
# Visit: https://status.hedera.com/
```

### "Transaction Failed"
- Verify account has sufficient HBAR balance
- Check if account ID and private key match
- Ensure network setting is correct (testnet/mainnet)

## 🎉 Success Indicators

When everything works correctly, you'll see:

```
✅ Live Blockchain Mode
   Connected to Hedera TESTNET

🎉 Token Creation Complete!

Token Information:
   Token ID: 0.0.123456
   Transaction ID: 0.0.xxxxx@1234567890-123
   Treasury Account: 0.0.your-account
   Explorer: https://hashscan.io/testnet/token/0.0.123456

💡 Next Steps:
   • Use this token ID in your application
   • Transfer tokens to other accounts
   • Integrate with your frontend
```

## 🚀 What's Next?

With Hedera integration working, you can:

1. **Build DApps**: Use generated templates with real token IDs
2. **Create NFTs**: Extend token creation for NFT collections
3. **Smart Contracts**: Deploy and interact with Hedera contracts
4. **Enterprise Integration**: Add compliance and governance features

The foundation is solid - time to build amazing blockchain applications! 🌟