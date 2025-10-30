import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';

export interface InputControllerOptions {
  enableEditorIntegration: boolean;
  enableTabCompletion: boolean;
  defaultEditor: string;
  tempDirectory: string;
  autoSave: boolean;
}

/**
 * InputController - Enhanced Input Handling
 * 
 * Provides advanced input features including external editor integration,
 * tab completion, and multi-line prompt editing.
 */
export class InputController {
  private options: InputControllerOptions;
  private tempFileCounter: number = 0;

  constructor(options: Partial<InputControllerOptions> = {}) {
    this.options = {
      enableEditorIntegration: true,
      enableTabCompletion: true,
      defaultEditor: this.detectDefaultEditor(),
      tempDirectory: path.join(os.tmpdir(), 'apix-editor'),
      autoSave: false,
      ...options
    };
  }

  /**
   * Initialize the input controller
   */
  async initialize(): Promise<void> {
    try {
      if (this.options.enableEditorIntegration) {
        await fs.ensureDir(this.options.tempDirectory);
      }

      if (this.options.enableTabCompletion) {
        this.setupTabCompletion();
      }

      logger.internal('info', 'Input Controller initialized', {
        editor: this.options.defaultEditor,
        editorIntegration: this.options.enableEditorIntegration,
        tabCompletion: this.options.enableTabCompletion
      });

    } catch (error: any) {
      logger.error('Failed to initialize Input Controller', error);
      // Disable features that failed to initialize
      this.options.enableEditorIntegration = false;
    }
  }

  /**
   * Open content in external editor (Ctrl+G functionality)
   */
  async openInEditor(content: string = '', options?: { language?: string; filename?: string }): Promise<string | null> {
    if (!this.options.enableEditorIntegration) {
      console.log(chalk.yellow('⚠️ External editor integration is disabled.'));
      return null;
    }

    try {
      // Create temporary file
      const tempFile = await this.createTempFile(content, options);
      
      console.log(chalk.blue(`\n📝 Opening editor: ${this.options.defaultEditor}`));
      console.log(chalk.gray(`Temp file: ${tempFile}`));
      console.log(chalk.gray('Save and close the editor to continue...\n'));

      // Open editor
      const success = await this.launchEditor(tempFile);
      
      if (!success) {
        console.log(chalk.red('❌ Failed to open editor or editor was cancelled.'));
        await this.cleanupTempFile(tempFile);
        return null;
      }

      // Read the edited content
      const editedContent = await fs.readFile(tempFile, 'utf8');
      
      // Clean up
      await this.cleanupTempFile(tempFile);

      console.log(chalk.green('✅ Editor session completed.'));
      
      // Show preview of changes if content was modified
      if (editedContent.trim() !== content.trim()) {
        console.log(chalk.blue('\n📋 Content updated:'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(this.formatContentPreview(editedContent));
        console.log(chalk.gray('─'.repeat(50)));
      }

      return editedContent.trim();

    } catch (error: any) {
      logger.error('Failed to open external editor', error);
      console.log(chalk.red(`❌ Editor error: ${error.message}`));
      return null;
    }
  }

  /**
   * Handle multi-line input with enhanced editing
   */
  async handleMultilineInput(prompt: string = 'Enter your message:'): Promise<string> {
    console.log(chalk.cyan(`\n${prompt}`));
    console.log(chalk.gray('(Press Ctrl+G to open in external editor, or type your message below)'));
    console.log(chalk.gray('(End with an empty line or type "EOF" to finish)'));

    const lines: string[] = [];
    let isFinished = false;

    while (!isFinished) {
      const { line } = await inquirer.prompt([{
        type: 'input',
        name: 'line',
        message: lines.length === 0 ? '>' : '|',
        validate: (input: string) => {
          // Check for special commands
          if (input.trim() === '\\edit' || input.trim() === '\\e') {
            // Open current content in editor
            this.openInEditor(lines.join('\n')).then(editedContent => {
              if (editedContent !== null) {
                lines.length = 0; // Clear existing lines
                lines.push(...editedContent.split('\n'));
              }
            });
            return 'Opening editor...';
          }
          return true;
        }
      }]);

      // Check for finish conditions
      if (line.trim() === '' && lines.length > 0) {
        isFinished = true;
      } else if (line.trim().toLowerCase() === 'eof') {
        isFinished = true;
      } else if (line.trim() === '\\edit' || line.trim() === '\\e') {
        // Handle editor opening (validation already triggered it)
        continue;
      } else {
        lines.push(line);
      }
    }

    return lines.join('\n').trim();
  }

  /**
   * Setup tab completion for bash commands
   */
  setupTabCompletion(): void {
    if (!this.options.enableTabCompletion) return;

    // This is a simplified tab completion setup
    // In a full implementation, this would integrate with readline or similar
    logger.debug('Tab completion setup (simplified mode)');
    
    // Note: Full tab completion would require deeper integration with the terminal
    // For now, we'll provide basic command suggestions through inquirer
  }

  /**
   * Get command suggestions for tab completion
   */
  getCommandSuggestions(partial: string): string[] {
    const apixCommands = [
      'analyze', 'add', 'init', 'status', 'health', 'generate', 'compose',
      'chat', 'validate', 'recommend', 'explain', 'compare', 'confidence',
      'debug', 'deploy', 'create-token', 'logs', 'last-error', 'debug-info'
    ];

    const bashCommands = [
      'ls', 'cd', 'pwd', 'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'cat', 'grep',
      'find', 'which', 'echo', 'export', 'git', 'npm', 'node', 'python'
    ];

    const allCommands = [...apixCommands, ...bashCommands];

    return allCommands
      .filter(cmd => cmd.startsWith(partial.toLowerCase()))
      .sort();
  }

  /**
   * Handle paste operations with smart formatting
   */
  handlePaste(content: string): string {
    // Clean up common paste issues
    let cleaned = content
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\t/g, '  ') // Convert tabs to spaces
      .trim();

    // Detect and handle code blocks
    if (this.looksLikeCode(cleaned)) {
      console.log(chalk.blue('🔍 Code detected in paste - applying formatting...'));
      cleaned = this.formatCodeBlock(cleaned);
    }

    return cleaned;
  }

  /**
   * Set the default editor
   */
  setDefaultEditor(editor: string): void {
    this.options.defaultEditor = editor;
    logger.info('Default editor changed', { editor });
  }

  /**
   * Get current configuration
   */
  getConfiguration(): InputControllerOptions {
    return { ...this.options };
  }

  // Private methods

  private detectDefaultEditor(): string {
    // Check environment variables
    const editorFromEnv = process.env.EDITOR || process.env.VISUAL;
    if (editorFromEnv) {
      return editorFromEnv;
    }

    // Platform-specific defaults
    switch (process.platform) {
      case 'win32':
        return 'notepad';
      case 'darwin':
        return 'nano'; // or 'open -t' for TextEdit
      default:
        return 'nano'; // Linux/Unix default
    }
  }

  private async createTempFile(content: string, options?: { language?: string; filename?: string }): Promise<string> {
    const timestamp = Date.now();
    const counter = ++this.tempFileCounter;
    
    let filename = options?.filename || `apix-input-${timestamp}-${counter}`;
    
    // Add appropriate extension based on language
    if (options?.language) {
      const extensions: Record<string, string> = {
        typescript: '.ts',
        javascript: '.js',
        python: '.py',
        json: '.json',
        yaml: '.yml',
        markdown: '.md',
        text: '.txt'
      };
      
      const ext = extensions[options.language] || '.txt';
      if (!filename.includes('.')) {
        filename += ext;
      }
    } else if (!filename.includes('.')) {
      filename += '.txt';
    }

    const tempFile = path.join(this.options.tempDirectory, filename);
    await fs.writeFile(tempFile, content, 'utf8');
    
    return tempFile;
  }

  private async launchEditor(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const editorCommand = this.options.defaultEditor;
      const editorArgs = this.getEditorArgs(editorCommand, filePath);
      
      const editor = spawn(editorCommand, editorArgs, {
        stdio: 'inherit', // Allow editor to take control of terminal
        shell: true
      });

      editor.on('close', (code) => {
        resolve(code === 0);
      });

      editor.on('error', (error) => {
        logger.error('Editor launch failed', error);
        resolve(false);
      });
    });
  }

  private getEditorArgs(editor: string, filePath: string): string[] {
    // Handle different editors and their specific arguments
    const editorName = path.basename(editor.toLowerCase());
    
    switch (editorName) {
      case 'code':
      case 'code.exe':
        return ['--wait', filePath];
      case 'subl':
        return ['--wait', filePath];
      case 'atom':
        return ['--wait', filePath];
      case 'notepad++.exe':
        return ['-multiInst', '-nosession', filePath];
      default:
        return [filePath];
    }
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.remove(filePath);
    } catch (error: any) {
      logger.warn('Failed to cleanup temp file', { filePath, error: error.message });
    }
  }

  private formatContentPreview(content: string, maxLines: number = 10): string {
    const lines = content.split('\n');
    
    if (lines.length <= maxLines) {
      return content;
    }

    const preview = lines.slice(0, maxLines).join('\n');
    const remaining = lines.length - maxLines;
    
    return `${preview}\n${chalk.gray(`... (${remaining} more lines)`)}`;
  }

  private looksLikeCode(content: string): boolean {
    // Simple heuristics to detect code
    const codeIndicators = [
      /^import\s+/m,
      /^export\s+/m,
      /function\s*\(/,
      /class\s+\w+/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /{[\s\S]*}/,
      /\[\s*[\s\S]*\]/,
      /^\s*\/\//m,
      /^\s*\/\*/m,
      /^\s*#/m
    ];

    return codeIndicators.some(pattern => pattern.test(content));
  }

  private formatCodeBlock(code: string): string {
    // Basic code formatting
    return code
      .split('\n')
      .map(line => line.trimRight()) // Remove trailing whitespace
      .join('\n')
      .replace(/\n{3,}/g, '\n\n'); // Normalize multiple blank lines
  }
}

export default InputController;