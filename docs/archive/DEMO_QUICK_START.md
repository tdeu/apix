# 🚀 APIX Quick Demo Setup

**Ready in 5 minutes - Demo in 90 seconds**

## Pre-Demo Checklist (30 seconds each)

### ✅ 1. Verify APIX Installation
```bash
apix --version  # Should show: 1.0.0
apix --help     # Should show all commands
```

### ✅ 2. Test Basic Commands  
```bash
cd ~/Desktop
mkdir demo-test && cd demo-test
echo '{"name":"test","scripts":{"dev":"next dev"},"dependencies":{"next":"^13.0.0","react":"^18.0.0"}}' > package.json

apix analyze    # Should detect next.js
apix health -q  # Should show "Project is healthy!"

cd .. && rmdir /s /q demo-test
```

### ✅ 3. Create Demo Project
```bash
npx create-next-app@latest my-hedera-demo --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-install
cd my-hedera-demo
npm install
```

### ✅ 4. Test Integration Flow
```bash
# Quick integration test
apix add hts --name "TestToken" --symbol "TEST"
apix add wallet --provider hashpack

# Verify success
ls src/lib/hedera/        # Should show hts files
ls src/components/        # Should show TokenManager, etc
ls src/app/api/tokens/    # Should show API routes

# Optional: Test build
npm run build
```

### ✅ 5. Browser Setup
- Install HashPack wallet extension
- Switch to Hedera testnet  
- Get testnet HBAR from faucet
- Open tabs: localhost:3000, hashscan.io/testnet

---

## 🎬 90-Second Demo Script

### Setup (10s)
```bash
cd my-hedera-demo
clear
```

### Demo Flow (80s)
```bash
# 1. Initialize (15s)
apix init
apix analyze

# 2. Add Hedera integrations (30s)
apix add hts --name "DemoToken" --symbol "DEMO" 
apix add wallet --provider hashpack

# 3. Launch and demo (35s)
npm run dev
# → Open localhost:3000
# → Connect wallet
# → Create token
# → Show live transaction
```

---

## 🎯 Success Criteria

**Technical:**
- [ ] All commands execute without errors
- [ ] Generated files are present and valid
- [ ] Wallet connects successfully  
- [ ] Token creation completes on testnet
- [ ] Transaction appears on HashScan

**Presentation:**
- [ ] Under 90 seconds total time
- [ ] Smooth, confident delivery
- [ ] Professional UI appearance
- [ ] Live blockchain interaction
- [ ] Clear value demonstration

---

## 🚨 Backup Plan

If live demo fails:
1. **Show generated code** - highlight quality and completeness
2. **Explain architecture** - professional patterns and best practices  
3. **Compare alternatives** - manual setup vs APIX automation
4. **Demonstrate health check** - `apix health` shows comprehensive analysis

---

## 💡 Key Messages

1. **"Modern web3 development starts with React and Next.js"**
2. **"APIX makes Hedera integration instant for these frameworks"** 
3. **"From idea to live transaction in under 2 minutes"**
4. **"Production-ready code with professional patterns"**
5. **"Built for the React ecosystem developers already use"**

---

**🎪 Break a leg! You've got this! 🚀**