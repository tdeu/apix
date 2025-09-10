#!/usr/bin/env node

/**
 * APIX Demo Verification Script
 * Ensures everything is ready for the perfect demo
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.cyan.bold('\n🎪 APIX Demo Verification\n'));

const checks = [];

// Test 1: APIX CLI Installation
function checkAPICLI() {
  try {
    const version = execSync('apix --version', { encoding: 'utf8' }).trim();
    return { 
      pass: true, 
      message: `APIX CLI installed (v${version})`,
      details: 'CLI is ready for demo commands'
    };
  } catch (error) {
    return { 
      pass: false, 
      message: 'APIX CLI not found or not working',
      fix: 'Run: npm link from APIX directory'
    };
  }
}

// Test 2: Node.js and npm versions
function checkNodeNpm() {
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    
    const nodeNum = parseInt(nodeVersion.replace('v', ''));
    if (nodeNum < 18) {
      return {
        pass: false,
        message: `Node.js ${nodeVersion} is too old`,
        fix: 'Install Node.js 18+ for optimal compatibility'
      };
    }
    
    return {
      pass: true,
      message: `Node.js ${nodeVersion}, npm ${npmVersion}`,
      details: 'Versions are compatible'
    };
  } catch (error) {
    return {
      pass: false,
      message: 'Node.js or npm not found',
      fix: 'Install Node.js 18+'
    };
  }
}

// Test 3: Next.js project creation
function checkNextJSCreation() {
  const testDir = 'apix-demo-test';
  
  try {
    // Clean up any existing test directory
    if (fs.existsSync(testDir)) {
      execSync(`rmdir /s /q ${testDir}`, { stdio: 'ignore' });
    }
    
    console.log('  🔄 Testing Next.js project creation...');
    
    // Create test project (with timeout)
    const createCmd = `npx create-next-app@latest ${testDir} --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes --no-install`;
    execSync(createCmd, { 
      stdio: 'pipe',
      timeout: 120000 // 2 minute timeout
    });
    
    if (fs.existsSync(path.join(testDir, 'package.json'))) {
      // Clean up
      execSync(`rmdir /s /q ${testDir}`, { stdio: 'ignore' });
      return {
        pass: true,
        message: 'Next.js project creation works',
        details: 'Demo project setup will succeed'
      };
    } else {
      return {
        pass: false,
        message: 'Next.js project creation failed',
        fix: 'Check internet connection and npm registry'
      };
    }
  } catch (error) {
    // Clean up on error
    try {
      if (fs.existsSync(testDir)) {
        execSync(`rmdir /s /q ${testDir}`, { stdio: 'ignore' });
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    return {
      pass: false,
      message: 'Next.js project creation failed',
      details: error.message,
      fix: 'Check internet connection, npm registry, and disk space'
    };
  }
}

// Test 4: APIX core commands
function checkAPICoreCommands() {
  const testDir = 'apix-cmd-test';
  
  try {
    // Create minimal test project
    if (fs.existsSync(testDir)) {
      execSync(`rmdir /s /q ${testDir}`, { stdio: 'ignore' });
    }
    
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      scripts: { dev: 'next dev' },
      dependencies: { next: '^13.0.0', react: '^18.0.0' }
    }, null, 2));
    
    // Test analyze command
    console.log('  🔄 Testing apix analyze...');
    const analyzeResult = execSync(`apix analyze`, { 
      cwd: testDir, 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    if (!analyzeResult.includes('next.js')) {
      throw new Error('Analysis did not detect Next.js framework');
    }
    
    // Test health command
    console.log('  🔄 Testing apix health...');
    const healthResult = execSync(`apix health --quick`, { 
      cwd: testDir, 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Clean up
    execSync(`rmdir /s /q ${testDir}`, { stdio: 'ignore' });
    
    return {
      pass: true,
      message: 'APIX core commands working',
      details: 'analyze and health commands functional'
    };
    
  } catch (error) {
    // Clean up on error
    try {
      if (fs.existsSync(testDir)) {
        execSync(`rmdir /s /q ${testDir}`, { stdio: 'ignore' });
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    return {
      pass: false,
      message: 'APIX core commands failed',
      details: error.message,
      fix: 'Rebuild APIX: npm run build && npm link'
    };
  }
}

// Test 5: Template system
function checkTemplateSystem() {
  try {
    const templatesDir = path.join(__dirname, 'templates');
    if (!fs.existsSync(templatesDir)) {
      return {
        pass: false,
        message: 'Templates directory not found',
        fix: 'Ensure templates directory exists in project root'
      };
    }
    
    // Check for key templates
    const requiredTemplates = [
      'components/react/TokenManager.hbs',
      'hooks/react/useTokens.hbs',
      'utils/common/hts-operations.hbs',
      'contexts/react/WalletContext.hbs'
    ];
    
    const missingTemplates = requiredTemplates.filter(template => {
      const templatePath = path.join(templatesDir, template);
      return !fs.existsSync(templatePath);
    });
    
    if (missingTemplates.length > 0) {
      return {
        pass: false,
        message: 'Missing required templates',
        details: missingTemplates,
        fix: 'Ensure all template files are present'
      };
    }
    
    return {
      pass: true,
      message: 'Template system ready',
      details: `${requiredTemplates.length} key templates verified`
    };
    
  } catch (error) {
    return {
      pass: false,
      message: 'Template system check failed',
      details: error.message
    };
  }
}

// Test 6: Integration generation (full test)
function checkIntegrationGeneration() {
  const testDir = 'apix-integration-test';
  
  try {
    console.log('  🔄 Testing full integration generation...');
    
    // Clean up any existing test directory
    if (fs.existsSync(testDir)) {
      execSync(`rmdir /s /q ${testDir}`, { stdio: 'ignore' });
    }
    
    // Create test project
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
      name: 'integration-test',
      version: '1.0.0',
      scripts: { dev: 'next dev', build: 'next build' },
      dependencies: { 
        next: '^13.0.0', 
        react: '^18.0.0',
        '@hashgraph/sdk': '^2.40.0'
      }
    }, null, 2));
    
    // Test HTS integration
    console.log('  🔄 Testing HTS integration...');
    const htsResult = execSync(`apix add hts --name "TestToken" --symbol "TEST"`, {
      cwd: testDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    if (!htsResult.includes('Integration Complete')) {
      throw new Error('HTS integration did not complete successfully');
    }
    
    // Verify generated files exist
    const expectedFiles = [
      'lib/hedera/hts-operations.ts',
      'components/TokenManager.tsx',
      'app/api/tokens/create/route.ts'
    ];
    
    const missingFiles = expectedFiles.filter(file => {
      return !fs.existsSync(path.join(testDir, file));
    });
    
    if (missingFiles.length > 0) {
      throw new Error(`Generated files missing: ${missingFiles.join(', ')}`);
    }
    
    // Test wallet integration
    console.log('  🔄 Testing Wallet integration...');
    const walletResult = execSync(`apix add wallet --provider hashpack`, {
      cwd: testDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    if (!walletResult.includes('Integration Complete')) {
      throw new Error('Wallet integration did not complete successfully');
    }
    
    // Clean up
    execSync(`rmdir /s /q ${testDir}`, { stdio: 'ignore' });
    
    return {
      pass: true,
      message: 'Full integration generation working',
      details: 'HTS and wallet integrations completed successfully'
    };
    
  } catch (error) {
    // Clean up on error
    try {
      if (fs.existsSync(testDir)) {
        execSync(`rmdir /s /q ${testDir}`, { stdio: 'ignore' });
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    return {
      pass: false,
      message: 'Integration generation failed',
      details: error.message,
      fix: 'Check templates and generation logic'
    };
  }
}

// Run all checks
async function runAllChecks() {
  const startTime = Date.now();
  
  console.log('Running comprehensive demo verification...\n');
  
  const testSuite = [
    { name: 'APIX CLI Installation', test: checkAPICLI },
    { name: 'Node.js & npm Versions', test: checkNodeNpm },
    { name: 'Next.js Project Creation', test: checkNextJSCreation },
    { name: 'APIX Core Commands', test: checkAPICoreCommands },
    { name: 'Template System', test: checkTemplateSystem },
    { name: 'Integration Generation', test: checkIntegrationGeneration }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, test } of testSuite) {
    process.stdout.write(chalk.cyan(`📋 ${name}... `));
    
    try {
      const result = test();
      
      if (result.pass) {
        console.log(chalk.green('✅ PASS'));
        if (result.details) {
          console.log(chalk.gray(`   ${result.details}`));
        }
        passed++;
      } else {
        console.log(chalk.red('❌ FAIL'));
        console.log(chalk.red(`   ${result.message}`));
        if (result.details) {
          console.log(chalk.gray(`   Details: ${result.details}`));
        }
        if (result.fix) {
          console.log(chalk.yellow(`   Fix: ${result.fix}`));
        }
        failed++;
      }
    } catch (error) {
      console.log(chalk.red('❌ ERROR'));
      console.log(chalk.red(`   ${error.message}`));
      failed++;
    }
    
    console.log();
  }
  
  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(chalk.bold('\n📊 Demo Verification Summary:'));
  console.log(chalk.green(`✅ Passed: ${passed}`));
  console.log(chalk.red(`❌ Failed: ${failed}`));
  console.log(chalk.gray(`⏱️  Duration: ${duration}s`));
  
  if (failed === 0) {
    console.log(chalk.green.bold('\n🎉 Demo Ready! All systems go! 🚀'));
    console.log(chalk.cyan('You can now run the demo with confidence.'));
    console.log(chalk.gray('Suggested next step: Run the demo script manually once.'));
  } else {
    console.log(chalk.red.bold('\n🚨 Demo Not Ready'));
    console.log(chalk.yellow('Please fix the failing checks before demo.'));
    console.log(chalk.gray('Each failure includes suggested fixes above.'));
  }
  
  console.log(chalk.gray('\n---'));
  console.log(chalk.cyan('💡 Demo tip: Practice the 90-second flow at least 3 times!'));
  
  process.exit(failed === 0 ? 0 : 1);
}

// Run the verification
runAllChecks().catch(error => {
  console.error(chalk.red.bold('\n❌ Verification failed:'), error);
  process.exit(1);
});