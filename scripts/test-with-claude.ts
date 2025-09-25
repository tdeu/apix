import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TestResult {
  success: boolean;
  output: string;
  errors: string;
  command: string;
  timestamp: string;
}

class ClaudeTestAnalyzer {
  async runTestWithAnalysis(command: string): Promise<void> {
    console.log(`\n🧪 Running: ${command}`);
    console.log(`📝 Capturing output for Claude analysis...`);
    
    const result = await this.runCommand(command);
    
    if (result.success) {
      console.log(`✅ Test passed - no Claude analysis needed`);
      return;
    }
    
    console.log(`❌ Test failed - generating Claude analysis prompt...`);
    await this.generateClaudePrompt(result);
  }
  
  private async runCommand(command: string): Promise<TestResult> {
    return new Promise((resolve) => {
      const process = spawn(command, [], { 
        stdio: 'pipe',
        shell: true 
      });
      
      let output = '';
      let errors = '';
      
      process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log(text); // Still show in terminal
      });
      
      process.stderr.on('data', (data) => {
        const text = data.toString();
        errors += text;
        console.error(text); // Still show in terminal
      });
      
      process.on('close', (code) => {
        resolve({
          success: code === 0,
          output: output,
          errors: errors,
          command: command,
          timestamp: new Date().toISOString()
        });
      });
    });
  }
  
  private async generateClaudePrompt(result: TestResult): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join('logs', `test-failure-${timestamp}.md`);
    
    const claudePrompt = this.createAnalysisPrompt(result);
    
    fs.writeFileSync(logFile, claudePrompt);
    
    console.log(`\n📄 Claude analysis prompt saved to: ${logFile}`);
    console.log(`\n🤖 COPY THIS INTO CLAUDE CODE:`);
    console.log(`\n${'='.repeat(80)}`);
    console.log(claudePrompt);
    console.log(`${'='.repeat(80)}\n`);
    
    // Also save as clipboard-ready format
    const clipboardFile = path.join('logs', 'latest-failure-for-claude.md');
    fs.writeFileSync(clipboardFile, claudePrompt);
    console.log(`💾 Also saved to ${clipboardFile} for easy copying`);
  }
  
  private createAnalysisPrompt(result: TestResult): string {
    return `# APIX Test Failure - Claude Code Analysis Request

## Context
Command failed in VS Code but may have worked in Claude Code testing environment.

## Failed Command
\`\`\`bash
${result.command}
\`\`\`

## Error Output
\`\`\`
${result.errors}
\`\`\`

## Full Output
\`\`\`
${result.output.length > 3000 ? result.output.substring(0, 3000) + '\n... (truncated)' : result.output}
\`\`\`

## Timestamp
${result.timestamp}

---

**Code Quality Reviewer**: Please analyze this real VS Code test failure:

1. **Root Cause**: Why did this fail in VS Code when Claude Code testing might pass?
2. **Environment Differences**: What's different between Claude's test environment and actual execution?
3. **Specific Fix**: What exact code changes are needed?
4. **Testing Strategy**: How should I test this properly going forward?

**Integration Test Specialist**: What integration issues does this reveal?

Focus on:
- Missing dependencies or configuration
- Environment variable issues
- TypeScript compilation problems
- Runtime vs compile-time differences
- API connectivity issues

Provide specific file paths and code fixes.`;
  }
}

// Main execution
async function main() {
  const testCommand = process.argv[2];
  
  if (!testCommand) {
    console.log('Usage: npm run test:claude "your-command-here"');
    console.log('Example: npm run test:claude "npm run apix:health"');
    process.exit(1);
  }
  
  const analyzer = new ClaudeTestAnalyzer();
  await analyzer.runTestWithAnalysis(testCommand);
}

main().catch(console.error);