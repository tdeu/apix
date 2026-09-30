# Security Incident Report - Exposed API Key

**Date:** October 31, 2025
**Severity:** HIGH
**Status:** ✅ RESOLVED
**Key Revoked:** October 31, 2025

---

## 📋 Incident Summary

An OpenAI API key was accidentally committed to the public repository in the `.env.example` file and pushed to GitHub (both upstream and origin).

## 🔍 Details

**Exposed Credential:**
- **Type:** OpenAI API Key
- **Location:** `.env.example` (Line 15)
- **Key Pattern:** `sk-proj-[REDACTED-IN-INCIDENT-REPORT]`
- **Note:** Full key has been revoked and is no longer functional
- **Repositories Affected:**
  - https://github.com/tdeu/apix (upstream)
  - https://github.com/0xfishbone/apix (fork)

**Exposure Timeline:**
- Unknown when first committed (likely during initial development)
- Discovered: October 31, 2025
- Fixed in latest commit: `e6dd1ae`
- Still exists in git history prior to this commit

## ⚠️ Risk Assessment

**Current Risks:**
1. **Unauthorized API Usage:** Anyone who cloned the repository has access to the key
2. **Billing Impact:** Key could be used to make OpenAI API calls charged to your account
3. **Quota Exhaustion:** Could deplete API usage limits
4. **Historical Exposure:** Key exists in all previous commits in git history

**Likelihood:** HIGH (Public repository, easily discoverable)
**Impact:** MEDIUM to HIGH (Financial and usage quota impact)

## ✅ Immediate Actions Taken

1. **✅ Fixed `.env.example`**
   - Replaced real API key with placeholder `sk-proj-...`
   - Commit: `e6dd1ae`
   - Pushed to both upstream and origin

2. **✅ Verified `.env` Protection**
   - Confirmed `.env` is in `.gitignore`
   - Verified actual `.env` file is NOT tracked by git

3. **✅ Security Audit**
   - Checked for other exposed credentials
   - Verified Hedera test account keys are safe (public testnet accounts)
   - Confirmed all other API key placeholders are redacted

## 🚨 IMMEDIATE ACTION REQUIRED

**You MUST complete these steps NOW:**

### 1. Revoke the Exposed OpenAI API Key

**Steps:**
1. Go to https://platform.openai.com/api-keys
2. Find the key starting with `sk-proj-u5VIAE...`
3. Click "Delete" or "Revoke"
4. Confirm deletion

**Why:** Until revoked, anyone with the key can use it

### 2. Create a New API Key

**Steps:**
1. On https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Give it a name (e.g., "APIX Local Development")
4. Copy the new key immediately
5. Add to your LOCAL `.env` file (NOT `.env.example`)

### 3. Monitor for Unauthorized Usage

**Steps:**
1. Go to https://platform.openai.com/usage
2. Check recent API usage for unusual patterns
3. Look for requests you didn't make
4. Check billing for unexpected charges

### 4. Consider Additional Security Measures

**Optional but Recommended:**
- Set up API key usage limits in OpenAI dashboard
- Enable usage alerts for unusual activity
- Implement IP restrictions if available
- Rotate keys regularly (every 90 days)

## 📊 What Was NOT Exposed

**Safe Items:**
- ✅ Hedera private keys in `test-accounts.ts` (0.0.2, 0.0.3 are public testnet accounts)
- ✅ Anthropic API key (only placeholder `sk-ant-...` committed)
- ✅ Groq API key (only placeholder `gsk_...` committed)
- ✅ Actual `.env` file (properly gitignored, never committed)
- ✅ User credentials or personal data

## 🔧 Technical Details

**Affected File:**
```bash
.env.example
Line 15: OPENAI_API_KEY=[EXPOSED-KEY-REDACTED]
```

**Fix Applied:**
```diff
- OPENAI_API_KEY=[REAL-KEY-REDACTED-REVOKED]
+ OPENAI_API_KEY=sk-proj-...
```

## 🎯 Long-term Mitigation

### Completed:
1. ✅ Fixed current version of `.env.example`
2. ✅ Documented incident for awareness
3. ✅ Verified `.gitignore` includes `.env`

### Remaining (Optional):
1. ⚠️ **Rewrite Git History** (Advanced, breaks existing clones)
   - Would remove key from all historical commits
   - Requires force push to all remotes
   - Breaks any existing clones/forks
   - **Not recommended** for already-published repositories

2. ✅ **Use Git Secrets Scanner** (Preventive)
   - Install pre-commit hooks to detect secrets
   - Use tools like `git-secrets` or `gitleaks`
   - Prevent future accidental commits

### Recommended Going Forward:

**For Development:**
```bash
# Never commit actual credentials
# Always use .env.example with placeholders
# Keep real credentials in .env (gitignored)

# Example .env.example (SAFE):
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# Example .env (LOCAL ONLY):
OPENAI_API_KEY=sk-proj-[YOUR_ACTUAL_KEY]
ANTHROPIC_API_KEY=sk-ant-[YOUR_ACTUAL_KEY]
```

**Git Pre-commit Hook:**
```bash
# .git/hooks/pre-commit
#!/bin/bash
if git diff --cached | grep -E "sk-proj-[A-Za-z0-9]{32,}"; then
    echo "❌ ERROR: OpenAI API key detected in commit!"
    exit 1
fi
```

## 📝 Lessons Learned

1. **Always use placeholders in example files**
   - `.env.example` should NEVER contain real credentials
   - Use patterns like `sk-proj-...` or `your-key-here`

2. **Implement automated secret scanning**
   - GitHub has built-in secret scanning (may have already alerted you)
   - Use pre-commit hooks to catch secrets before commit
   - Consider tools like `gitleaks`, `git-secrets`, `trufflehog`

3. **Regular security audits**
   - Periodically scan repository for exposed credentials
   - Review `.gitignore` to ensure sensitive files are excluded
   - Check git history for accidental commits

4. **Immediate revocation on exposure**
   - Assume any exposed credential is compromised
   - Revoke immediately, don't wait to see if it's used
   - Rotate all related credentials as precaution

## 🔗 Related Resources

- **OpenAI Security Best Practices:** https://platform.openai.com/docs/guides/safety-best-practices
- **GitHub Secret Scanning:** https://docs.github.com/en/code-security/secret-scanning
- **Git Secrets Tool:** https://github.com/awslabs/git-secrets
- **GitLeaks Scanner:** https://github.com/gitleaks/gitleaks

## ✅ Resolution Checklist

- [x] Identified exposed credential
- [x] Fixed `.env.example` with placeholder
- [x] Committed and pushed fix to all remotes
- [x] Documented incident
- [x] **Revoked exposed OpenAI API key** ✅ (October 31, 2025)
- [ ] Generated new API key (recommended for continued development)
- [ ] Updated local `.env` with new key (if generated)
- [ ] Monitored usage for unauthorized activity (recommended)
- [ ] Set up usage alerts (optional)
- [ ] Installed git-secrets or pre-commit hooks (recommended)

---

**Status:** ✅ FULLY RESOLVED - Exposed key has been revoked. No further critical actions required.

**Resolution:** Key revoked on October 31, 2025. Repository fixed and secure.

**Contact:** For questions about this incident, contact moustapha.diop@7digitslab.com

---

**Last Updated:** October 31, 2025
**Report Version:** 1.0
