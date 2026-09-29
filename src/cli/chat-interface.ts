import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { ConversationEngine } from '../ai/conversation/conversation-engine';
import { AIRequestError, AIUnavailableError } from '../ai/errors';
import { LimitationHandler } from '../ai/limitations/limitation-handler';
import { ErrorRecoverySystem } from '../ai/recovery/error-recovery-system';
import { TerminalInterfaceController } from '../ui/terminal-interface-controller';
import { 
  ConversationResponse, 
  ConversationContext, 
  UserPreferences 
} from '../types/conversation';
import { EnterpriseContext } from '../types/enterprise';

/**
 * ChatInterface - Interactive Conversational CLI
 * 
 * Provides natural language interface for enterprise Hedera development
 * with intelligent conversation management and context awareness.
 */
export class ChatInterface {
  private conversationEngine: ConversationEngine;
  private limitationHandler: LimitationHandler;
  private errorRecovery: ErrorRecoverySystem;
  private terminalInterface: TerminalInterfaceController | null = null;
  private currentSessionId: string;
  private userPreferences: UserPreferences;
  private isActive: boolean = false;
  private enhancedMode: boolean = true;

  constructor() {
    this.conversationEngine = new ConversationEngine({ command: 'chat' });
    this.limitationHandler = new LimitationHandler();
    this.errorRecovery = new ErrorRecoverySystem({ command: 'chat' });
    this.currentSessionId = uuidv4();
    this.userPreferences = this.getDefaultPreferences();
    
    // Terminal interface will be initialized later if enhanced mode is enabled
  }

  /**
   * Start interactive chat session
   */
  async startChat(options: ChatOptions = {}): Promise<void> {
    try {
      this.isActive = true;

      // Show welcome screen first, before any enhanced UI
      this.displayWelcome();

      // Start in clean mode if requested (no enhanced features at all)
      if (options.cleanMode || options.disableEnhancedUI) {
        this.enhancedMode = false;
        logger.info('Starting in clean mode - enhanced features disabled');
      }
      
      // Initialize enhanced terminal interface if enabled and not disabled
      if (this.enhancedMode && !options.disableEnhancedUI && !options.cleanMode) {
        try {
          // Initialize terminal interface only when needed
          this.terminalInterface = new TerminalInterfaceController();
          this.setupTerminalInterfaceListeners();
          
          await this.terminalInterface.initialize();
          await this.terminalInterface.startSession();
          
          // Update session metrics quietly
          this.terminalInterface.updateSessionMetrics({
            costAccumulated: 0,
            tokensUsed: 0,
            maxTokens: 8192
          });
          
          // Don't set state to idle immediately - let it be quiet
        } catch (error: any) {
          logger.warn('Enhanced terminal interface failed to initialize, using basic mode', error);
          this.enhancedMode = false;
          this.terminalInterface = null;
        }
      } else {
        // Start in basic mode - no enhanced features
        this.enhancedMode = false;
        this.terminalInterface = null;
      }

      // Load session if specified
      if (options.sessionFile) {
        await this.loadSession(options.sessionFile);
      }

      // Set enterprise context if provided
      const enterpriseContext = await this.gatherEnterpriseContext(options);

      // Start conversation without state updates for clean experience
      if (this.enhancedMode && this.terminalInterface) {
        this.terminalInterface.updateState('planning', { step: 'Initializing conversation engine' });
      }
      
      const welcomeResponse = await this.conversationEngine.startSession(
        this.currentSessionId,
        enterpriseContext
      );

      if (this.enhancedMode && this.terminalInterface) {
        this.terminalInterface.updateState('idle');
      }
      
      this.displayResponse(welcomeResponse);

      // Main conversation loop
      await this.conversationLoop();

    } catch (error: any) {
      // No key, or the AI request failed: end the chat; `apix chat` reports it and exits 1
      if (error instanceof AIUnavailableError || error instanceof AIRequestError) {
        this.isActive = false;
        throw error;
      }
      logger.error('Chat interface error:', error);
      console.log(chalk.red('\n❌ Chat session encountered an error. Please try again.'));

      // Attempt error recovery
      await this.handleChatError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isActive = false;
      
      // Clean up enhanced terminal interface
      if (this.enhancedMode && this.terminalInterface) {
        await this.terminalInterface.stopSession();
      }
    }
  }

  /**
   * Main conversation loop
   */
  private async conversationLoop(): Promise<void> {
    while (this.isActive) {
      try {
        // Get user input
        const userInput = await this.getUserInput();

        // Handle special commands
        if (await this.handleSpecialCommands(userInput)) {
          continue;
        }

        // Add to history if enhanced mode is enabled
        if (this.enhancedMode && this.terminalInterface) {
          this.terminalInterface.addToHistory(userInput);
        }

        // Process message with state indicators only if enhanced mode is active
        if (this.enhancedMode && this.terminalInterface) {
          this.terminalInterface.updateState('thinking', { 
            thinkingMessage: 'Processing your request...' 
          });
        }
        
        try {
          const response = await this.conversationEngine.processMessage(
            userInput,
            this.currentSessionId
          );

          if (this.enhancedMode && this.terminalInterface) {
            this.terminalInterface.updateState('idle');
          }
          
          this.displayResponse(response);

          // Update metrics if available (placeholder for future metadata support)
          // if (response.metadata?.tokensUsed || response.metadata?.cost) {
          //   this.terminalInterface.updateSessionMetrics({
          //     tokensUsed: response.metadata.tokensUsed,
          //     costAccumulated: response.metadata.cost
          //   });
          // }

          // Handle action items if present
          if (response.requiresAction && response.cliCommands && response.cliCommands.length > 0) {
            await this.handleActionItems(response);
          }

        } catch (processingError: any) {
          if (this.enhancedMode && this.terminalInterface) {
            this.terminalInterface.updateState('idle');
          }
          await this.handleProcessingError(processingError instanceof Error ? processingError : new Error(String(processingError)), userInput);
        }

      } catch (inputError) {
        if (inputError instanceof AIUnavailableError || inputError instanceof AIRequestError) {
          throw inputError;
        }
        logger.error('Input error:', inputError);
        console.log(chalk.yellow('⚠️ There was an issue with your input. Please try again.'));
      }
    }
  }

  /**
   * Get user input with enhanced UX
   */
  private async getUserInput(): Promise<string> {
    const { message } = await inquirer.prompt([{
      type: 'input',
      name: 'message',
      message: chalk.cyan('💬 You:'),
      validate: (input: string) => {
        if (input.trim().length === 0) {
          return 'Please enter a message';
        }
        return true;
      },
      transformer: (input: string) => {
        // Show typing indicator for long messages
        if (input.length > 100) {
          return input.substring(0, 97) + '...';
        }
        return input;
      }
    }]);

    return message.trim();
  }

  /**
   * Handle special chat commands
   */
  private async handleSpecialCommands(input: string): Promise<boolean> {
    const command = input.toLowerCase().trim();

    switch (command) {
      case '/exit':
      case '/quit':
      case '/bye':
        await this.exitChat();
        return true;

      case '/help':
        this.displayHelp();
        return true;

      case '/save':
        await this.saveCurrentSession();
        return true;

      case '/clear':
        this.clearScreen();
        return true;

      case '/status':
        await this.displayStatus();
        return true;

      case '/preferences':
        await this.updatePreferences();
        return true;

      case '/debug':
        await this.toggleDebugMode();
        return true;

      case '/limitations':
        await this.explainLimitations();
        return true;

      case '/statusline':
        await this.configureStatusLine();
        return true;

      case '/thinking':
        await this.toggleThinkingMode();
        return true;

      case '/editor':
        await this.openEditor();
        return true;

      case '/history':
        await this.showHistory();
        return true;

      case '/search':
        await this.searchHistory();
        return true;

      case '/ui':
        await this.toggleEnhancedUI();
        return true;

      default:
        if (command.startsWith('/load ')) {
          const sessionFile = command.substring(6).trim();
          await this.loadSession(sessionFile);
          return true;
        }
        return false;
    }
  }

  /**
   * Display conversation response with enhanced formatting
   */
  private displayResponse(response: ConversationResponse): void {
    console.log('\n' + '─'.repeat(80));
    console.log(chalk.blue('🤖 APIX AI:'));
    console.log('─'.repeat(80));

    // Display error information if present
    if (response.error) {
      console.log(chalk.red(`\n❌ Anthropic API Error: ${response.error.message}`));
      if (response.error.status) {
        console.log(chalk.red(`   Status: ${response.error.status}`));
      }
      if (response.error.details) {
        console.log(chalk.red(`   Details: ${response.error.details}`));
      }
      console.log(chalk.yellow('\n⚠️ Falling back to basic response mode.\n'));
    }

    // Display main content with formatting
    const formattedContent = this.formatResponseContent(response.content);
    console.log(formattedContent);

    // Display confidence if below threshold
    if (response.confidence < 0.8) {
      console.log(chalk.yellow(`\n🎯 Confidence: ${Math.round(response.confidence * 100)}%`));
    }

    // Display limitations if present
    if (response.limitations) {
      this.displayLimitations(response.limitations);
    }

    // Display suggestions
    if (response.suggestions && response.suggestions.length > 0) {
      console.log(chalk.gray('\n💡 Suggestions:'));
      response.suggestions.forEach((suggestion, index) => {
        console.log(chalk.gray(`   ${index + 1}. ${suggestion}`));
      });
    }

    // Display CLI commands if present
    if (response.cliCommands && response.cliCommands.length > 0) {
      console.log(chalk.green('\n⚡ Ready-to-run commands:'));
      response.cliCommands.forEach((cmd, index) => {
        console.log(chalk.green(`   ${index + 1}. ${cmd.command}`));
        console.log(chalk.gray(`      ${cmd.description}`));
      });
    }

    console.log('─'.repeat(80) + '\n');
  }

  /**
   * Format response content with rich text
   */
  private formatResponseContent(content: string): string {
    return content
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, chalk.bold('$1'))
      // Italic text
      .replace(/\*(.*?)\*/g, chalk.italic('$1'))
      // Code blocks
      .replace(/```(.*?)```/gs, (match, code) => {
        return '\n' + chalk.bgBlack(chalk.white(code)) + '\n';
      })
      // Inline code
      .replace(/`(.*?)`/g, chalk.bgGray(chalk.black(' $1 ')))
      // Headers
      .replace(/^### (.*$)/gm, chalk.bold.cyan('$1'))
      .replace(/^## (.*$)/gm, chalk.bold.blue('$1'))
      .replace(/^# (.*$)/gm, chalk.bold.magenta('$1'))
      // Lists
      .replace(/^- (.*$)/gm, chalk.yellow('• $1'))
      .replace(/^\d+\. (.*$)/gm, (match, text, offset, string) => {
        const lineNum = string.substring(0, offset).split('\n').length;
        return chalk.yellow(`${lineNum}. ${text}`);
      });
  }

  /**
   * Display limitations in user-friendly format
   */
  private displayLimitations(limitations: any): void {
    console.log(chalk.yellow('\n⚠️ AI Capability Assessment:'));
    
    if (limitations.highConfidenceAreas?.length > 0) {
      console.log(chalk.green('\n✅ High Confidence Areas:'));
      limitations.highConfidenceAreas.forEach((area: any) => {
        console.log(chalk.green(`   • ${area.name}: ${Math.round(area.confidence * 100)}%`));
      });
    }

    if (limitations.lowConfidenceAreas?.length > 0) {
      console.log(chalk.red('\n❗ Areas Requiring Expert Consultation:'));
      limitations.lowConfidenceAreas.forEach((area: any) => {
        console.log(chalk.red(`   • ${area.name}: ${Math.round(area.confidence * 100)}%`));
      });
    }

    if (limitations.fallbackOptions?.length > 0) {
      console.log(chalk.blue('\n🔄 Alternative Approaches:'));
      limitations.fallbackOptions.forEach((option: any, index: number) => {
        console.log(chalk.blue(`   ${index + 1}. ${option.description}`));
      });
    }
  }

  /**
   * Handle action items and CLI commands
   */
  private async handleActionItems(response: ConversationResponse): Promise<void> {
    if (!response.cliCommands || response.cliCommands.length === 0) {
      return;
    }

    const { executeCommands } = await inquirer.prompt([{
      type: 'confirm',
      name: 'executeCommands',
      message: 'Would you like to execute the suggested commands?',
      default: false
    }]);

    if (!executeCommands) {
      return;
    }

    // Show command selection if multiple commands
    if (response.cliCommands.length > 1) {
      const { selectedCommands } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedCommands',
        message: 'Select commands to execute:',
        choices: response.cliCommands.map((cmd, index) => ({
          name: `${cmd.command} - ${cmd.description}`,
          value: index,
          checked: true
        }))
      }]);

      // Execute selected commands
      for (const cmdIndex of selectedCommands) {
        await this.executeCommand(response.cliCommands[cmdIndex]);
      }
    } else {
      // Execute single command
      await this.executeCommand(response.cliCommands[0]);
    }
  }

  /**
   * Execute CLI command with error handling
   */
  private async executeCommand(command: any): Promise<void> {
    const spinner = ora(`Executing: ${command.command}`).start();

    try {
      // Import and execute the actual CLI command
      const { program } = await import('./index');
      
      // Parse and execute command
      const args = command.command.split(' ');
      await program.parseAsync(args, { from: 'user' });

      spinner.succeed(`Completed: ${command.command}`);

      // Display expected output if available
      if (command.expectedOutput) {
        console.log(chalk.gray(`Expected: ${command.expectedOutput}`));
      }

    } catch (error: any) {
      spinner.fail(`Failed: ${command.command}`);

      // Use error recovery system
      await this.handleCommandError(error instanceof Error ? error : new Error(String(error)), command);
    }
  }

  /**
   * Handle command execution errors
   */
  private async handleCommandError(error: Error, command: any): Promise<void> {
    console.log(chalk.red(`\n❌ Command failed: ${error.message}`));

    try {
      // AI diagnosis only: nothing is retried or changed
      const diagnosis = await this.errorRecovery.detectAndRecover(
        {
          type: 'cli-command',
          parameters: { command: command.command },
          originalRequirement: 'Execute CLI command',
          projectContext: {}
        },
        error
      );

      console.log(chalk.yellow('\n⚠️ Suggestions:'));
      diagnosis.recommendations.forEach(rec => {
        console.log(chalk.yellow(`   • ${rec}`));
      });
      console.log(chalk.gray(`   ${diagnosis.message}`));

    } catch (diagnosisError) {
      const reason = diagnosisError instanceof Error ? diagnosisError.message : String(diagnosisError);
      console.log(chalk.red(`\n❌ No AI diagnosis available: ${reason}`));
    }
  }

  /**
   * Handle processing errors with graceful degradation
   */
  private async handleProcessingError(error: Error, _userInput: string): Promise<void> {
    // AI errors end the chat: nothing here can answer without the AI
    if (error instanceof AIUnavailableError || error instanceof AIRequestError) {
      throw error;
    }
    console.log(chalk.red(`\n❌ ${error.message}`));
    console.log(chalk.gray('   Nothing was retried. You can rephrase and try again.'));
  }

  /**
   * Gather enterprise context from user
   */
  private async gatherEnterpriseContext(options: ChatOptions): Promise<Partial<EnterpriseContext>> {
    // Return provided context if available
    if (options.industry || options.context) {
      return {
        industry: options.industry as any, // Cast to allow string to EnterpriseIndustry assignment
        ...options.context
      };
    }

    // Quick context gathering for better assistance
    if (this.userPreferences.verbosityLevel !== 'concise') {
      const { gatherContext } = await inquirer.prompt([{
        type: 'confirm',
        name: 'gatherContext',
        message: 'Would you like to provide some context about your project for better assistance?',
        default: false
      }]);

      if (gatherContext) {
        return await this.promptForContext();
      }
    }

    return {};
  }

  /**
   * Prompt for enterprise context
   */
  private async promptForContext(): Promise<Partial<EnterpriseContext>> {
    const contextQuestions = [
      {
        type: 'list',
        name: 'industry',
        message: 'What industry are you working in?',
        choices: [
          'Financial Services',
          'Healthcare',
          'Supply Chain',
          'Manufacturing',
          'Insurance',
          'Real Estate',
          'Government',
          'Technology',
          'Other',
          'Skip'
        ],
        filter: (value: string) => value === 'Skip' ? null : value.toLowerCase().replace(' ', '-')
      },
      {
        type: 'list',
        name: 'companySize',
        message: 'What size is your organization?',
        choices: ['Startup', 'Small', 'Medium', 'Large', 'Enterprise', 'Skip'],
        filter: (value: string) => value === 'Skip' ? null : value.toLowerCase()
      },
      {
        type: 'input',
        name: 'currentProject',
        message: 'Briefly describe your current project (optional):',
        validate: (input: string) => input.length <= 200 || 'Please keep it under 200 characters'
      }
    ];

    const answers = await inquirer.prompt(contextQuestions);
    
    // Filter out null values and ensure proper typing
    const filteredAnswers = Object.fromEntries(
      Object.entries(answers).filter(([_, value]) => value !== null && value !== '')
    );

    // Convert answers to proper EnterpriseContext format
    const context: Partial<EnterpriseContext> = {};

    if (filteredAnswers.industry) {
      context.industry = filteredAnswers.industry as any;
    }

    if (filteredAnswers.companySize) {
      context.size = filteredAnswers.companySize as any;
    }

    return context;
  }

  /**
   * Display welcome message
   */
  private displayWelcome(): void {
    const { formatter } = require('../utils/output-formatter');
    const { logger, LogLevel } = require('../utils/logger');
    
    // Only clear screen if in verbose mode
    if (logger.isLevelEnabled(LogLevel.VERBOSE)) {
      console.clear();
    }
    
    // Minimal welcome message
    console.log(chalk.bold('APIX AI'), chalk.gray('Chat Mode'));
    
    // Show additional information only in verbose mode
    if (logger.isLevelEnabled(LogLevel.VERBOSE)) {
      console.log(chalk.gray('Your intelligent Hedera development assistant\n'));
      console.log(chalk.gray('Special commands: /help /save /exit'));
      formatter.separator('─', 60);
    } else {
      // Just a simple separator for clean mode
      console.log();
    }
  }

  /**
   * Display help information
   */
  private displayHelp(): void {
    console.log(chalk.bold('\n📖 APIX AI Chat Help'));
    console.log('═'.repeat(50));
    
    console.log(chalk.cyan('\n🗣️ Conversation:'));
    console.log('• Describe your blockchain requirements in natural language');
    console.log('• Ask about Hedera services, implementation patterns, or best practices');
    console.log('• Request code generation or architectural guidance');
    console.log('• Get help with troubleshooting and debugging');

    console.log(chalk.cyan('\n⚡ Special Commands:'));
    console.log('• /help - Show this help message');
    console.log('• /save - Save current conversation session');
    console.log('• /load <file> - Load previous conversation session');
    console.log('• /status - Show current session information');
    console.log('• /limitations - Explain AI capabilities and limitations');
    console.log('• /preferences - Update your preferences');
    console.log('• /clear - Clear the screen');
    console.log('• /debug - Toggle debug mode');
    console.log('• /exit - End the conversation');

    if (this.enhancedMode) {
      console.log(chalk.cyan('\n🚀 Enhanced UI Commands:'));
      console.log('• /statusline - Configure real-time status line');
      console.log('• /thinking - Toggle AI thinking mode on/off');
      console.log('• /editor - Open external editor for input (Ctrl+G)');
      console.log('• /history - View recent command history');
      console.log('• /search - Search command history (Ctrl+R)');
      console.log('• /ui - Toggle enhanced UI on/off');
    } else {
      console.log(chalk.gray('\n💡 Enhanced Features Available:'));
      console.log(chalk.gray('• Use /ui to enable enhanced terminal interface'));
      console.log(chalk.gray('• Real-time status line with session metrics'));
      console.log(chalk.gray('• Searchable command history with Ctrl+R'));
      console.log(chalk.gray('• External editor integration with Ctrl+G'));
      console.log(chalk.gray('• AI thinking mode for detailed reasoning'));
    }

    console.log(chalk.cyan('\n🎯 Tips for Better Results:'));
    console.log('• Be specific about your requirements and constraints');
    console.log('• Mention your industry or use case for better context');
    console.log('• Ask about capabilities before requesting complex implementations');
    console.log('• Use follow-up questions to refine solutions');

    console.log('═'.repeat(50) + '\n');
  }

  /**
   * Exit chat gracefully
   */
  private async exitChat(): Promise<void> {
    const { saveSession } = await inquirer.prompt([{
      type: 'confirm',
      name: 'saveSession',
      message: 'Would you like to save this conversation session?',
      default: true
    }]);

    if (saveSession) {
      await this.saveCurrentSession();
    }

    console.log(chalk.green('\n👋 Thank you for using APIX AI! Happy building with Hedera!'));
    this.isActive = false;
  }

  /**
   * Save current conversation session
   */
  private async saveCurrentSession(): Promise<void> {
    try {
      const filename = `apix-chat-${new Date().toISOString().slice(0, 10)}-${this.currentSessionId.slice(0, 8)}.json`;
      await this.conversationEngine.saveSession(this.currentSessionId, filename);
      console.log(chalk.green(`💾 Session saved as: ${filename}`));
    } catch (error) {
      console.log(chalk.red('❌ Failed to save session:', error));
    }
  }

  /**
   * Load conversation session
   */
  private async loadSession(sessionFile: string): Promise<void> {
    try {
      this.currentSessionId = await this.conversationEngine.loadSession(sessionFile);
      console.log(chalk.green(`📂 Session loaded from: ${sessionFile}`));
    } catch (error) {
      console.log(chalk.red('❌ Failed to load session:', error));
    }
  }

  /**
   * Display current status
   */
  private async displayStatus(): Promise<void> {
    console.log(chalk.bold('\n📊 Session Status'));
    console.log('═'.repeat(30));
    console.log(`Session ID: ${this.currentSessionId.slice(0, 8)}...`);
    console.log(`Preferences: ${this.userPreferences.verbosityLevel} mode`);
    console.log(`Technical Level: ${this.userPreferences.technicalLevel}`);
    console.log(`LLM: ${this.userPreferences.preferredLLM}`);
    console.log('═'.repeat(30) + '\n');
  }

  /**
   * Update user preferences
   */
  private async updatePreferences(): Promise<void> {
    const preferences = await inquirer.prompt([
      {
        type: 'list',
        name: 'verbosityLevel',
        message: 'Response detail level:',
        choices: ['concise', 'detailed', 'comprehensive'],
        default: this.userPreferences.verbosityLevel
      },
      {
        type: 'list',
        name: 'technicalLevel',
        message: 'Your technical expertise:',
        choices: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: this.userPreferences.technicalLevel
      },
      {
        type: 'list',
        name: 'preferredLLM',
        message: 'Preferred AI model:',
        choices: ['auto', 'openai', 'anthropic'],
        default: this.userPreferences.preferredLLM
      }
    ]);

    this.userPreferences = { ...this.userPreferences, ...preferences };
    console.log(chalk.green('✅ Preferences updated!'));
  }

  /**
   * Explain AI limitations
   */
  private async explainLimitations(): Promise<void> {
    const spinner = ora('Analyzing current capabilities...').start();
    
    try {
      const capabilities = await this.limitationHandler.explainCapabilities();
      spinner.stop();

      console.log(chalk.bold('\n🎯 APIX AI Capabilities & Limitations'));
      console.log('═'.repeat(50));

      console.log(chalk.green('\n✅ Strong Capabilities:'));
      capabilities.strengths.forEach(strength => {
        console.log(chalk.green(`   • ${strength}`));
      });

      console.log(chalk.yellow('\n⚠️ Known Limitations:'));
      capabilities.limitations.forEach(limitation => {
        console.log(chalk.yellow(`   • ${limitation}`));
      });

      console.log(chalk.blue('\n🔄 Fallback Strategies:'));
      capabilities.fallbackStrategies.forEach(strategy => {
        console.log(chalk.blue(`   • ${strategy}`));
      });

      console.log('═'.repeat(50) + '\n');

    } catch (error) {
      spinner.stop();
      console.log(chalk.red('❌ Unable to analyze capabilities at the moment.'));
    }
  }

  /**
   * Toggle debug mode
   */
  private async toggleDebugMode(): Promise<void> {
    // Toggle logger level
    const currentLevel = process.env.LOG_LEVEL || 'info';
    const newLevel = currentLevel === 'debug' ? 'info' : 'debug';
    process.env.LOG_LEVEL = newLevel;
    
    console.log(chalk.blue(`🔧 Debug mode: ${newLevel === 'debug' ? 'ON' : 'OFF'}`));
  }

  /**
   * Configure the status line interactively
   */
  private async configureStatusLine(): Promise<void> {
    if (!this.enhancedMode || !this.terminalInterface) {
      console.log(chalk.yellow('⚠️ Enhanced UI is disabled. Status line is not available.'));
      return;
    }

    console.log(chalk.bold('\n⚙️ Status Line Configuration'));
    console.log('═'.repeat(50));

    const statusLineManager = (this.terminalInterface as any).statusLineManager;
    if (!statusLineManager) {
      console.log(chalk.red('❌ Status line manager not available.'));
      return;
    }

    const components = statusLineManager.getComponents();
    
    console.log(chalk.cyan('\n📊 Available Components:'));
    components.forEach((component: any, index: number) => {
      const status = component.enabled ? chalk.green('✓ enabled') : chalk.red('✗ disabled');
      console.log(`   ${index + 1}. ${component.label} - ${status}`);
    });

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Toggle component on/off', value: 'toggle' },
        { name: 'Reorder components', value: 'reorder' },
        { name: 'Add custom shell command', value: 'add-command' },
        { name: 'View current status line', value: 'preview' },
        { name: 'Reset to defaults', value: 'reset' },
        { name: 'Back to chat', value: 'back' }
      ]
    }]);

    switch (action) {
      case 'toggle':
        await this.toggleStatusComponent(statusLineManager, components);
        break;
      case 'add-command':
        await this.addCustomStatusCommand(statusLineManager);
        break;
      case 'preview':
        console.log(chalk.blue('\n🔍 Current Status Line Preview:'));
        statusLineManager.refresh();
        break;
      case 'reset':
        console.log(chalk.green('✅ Status line reset to defaults.'));
        break;
      case 'back':
        break;
    }
  }

  /**
   * Toggle thinking mode on/off
   */
  private async toggleThinkingMode(): Promise<void> {
    if (!this.enhancedMode || !this.terminalInterface) {
      console.log(chalk.yellow('⚠️ Enhanced UI is disabled. Thinking mode is not available.'));
      return;
    }

    const stateRenderer = (this.terminalInterface as any).stateRenderer;
    if (stateRenderer) {
      const enabled = stateRenderer.toggleThinkingMode();
      console.log(chalk.blue(`🧠 Thinking mode: ${enabled ? 'ON' : 'OFF'}`));
      
      if (enabled) {
        console.log(chalk.gray('AI will now show detailed reasoning and internal monologue.'));
      } else {
        console.log(chalk.gray('AI will show only final outputs.'));
      }
    }
  }

  /**
   * Open external editor for current input
   */
  private async openEditor(): Promise<void> {
    if (!this.enhancedMode || !this.terminalInterface) {
      console.log(chalk.yellow('⚠️ Enhanced UI is disabled. External editor integration is not available.'));
      return;
    }

    const { currentInput } = await inquirer.prompt([{
      type: 'input',
      name: 'currentInput',
      message: 'Current input to edit (or leave empty for new):',
      default: ''
    }]);

    const editedContent = await this.terminalInterface.openInEditor(currentInput);
    
    if (editedContent) {
      console.log(chalk.green('\n✅ Content ready to send:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(editedContent);
      console.log(chalk.gray('─'.repeat(50)));

      const { sendContent } = await inquirer.prompt([{
        type: 'confirm',
        name: 'sendContent',
        message: 'Send this content as your message?',
        default: true
      }]);

      if (sendContent) {
        // Process the edited content as if it were typed
        await this.processUserMessage(editedContent);
      }
    }
  }

  /**
   * Show command history
   */
  private async showHistory(): Promise<void> {
    if (!this.enhancedMode || !this.terminalInterface) {
      console.log(chalk.yellow('⚠️ Enhanced UI is disabled. History is not available.'));
      return;
    }

    const historyManager = (this.terminalInterface as any).historyManager;
    if (!historyManager) {
      console.log(chalk.red('❌ History manager not available.'));
      return;
    }

    const recentCommands = historyManager.getRecentCommands(20);
    
    console.log(chalk.bold('\n📚 Recent Commands'));
    console.log('═'.repeat(50));

    if (recentCommands.length === 0) {
      console.log(chalk.gray('No command history available.'));
      return;
    }

    recentCommands.forEach((entry: any, index: number) => {
      const timeAgo = this.getTimeAgo(entry.timestamp);
      const status = entry.success ? chalk.green('✓') : chalk.red('✗');
      console.log(`${status} ${chalk.cyan(String(index + 1).padStart(2))}. ${entry.command.substring(0, 60)}${entry.command.length > 60 ? '...' : ''} ${chalk.gray(`(${timeAgo})`)}`);
    });

    // Show statistics
    const stats = historyManager.getStatistics();
    console.log(chalk.blue('\n📊 Statistics:'));
    console.log(`   Total commands: ${stats.totalCommands}`);
    console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);
    console.log(`   Average session length: ${stats.averageSessionLength.toFixed(1)} commands`);

    if (stats.mostUsedCommands.length > 0) {
      console.log(chalk.blue('\n🔥 Most used commands:'));
      stats.mostUsedCommands.slice(0, 5).forEach((cmd: any, index: number) => {
        console.log(`   ${index + 1}. ${cmd.command} (${cmd.count} times)`);
      });
    }

    console.log('═'.repeat(50));
  }

  /**
   * Search command history
   */
  private async searchHistory(): Promise<void> {
    if (!this.enhancedMode || !this.terminalInterface) {
      console.log(chalk.yellow('⚠️ Enhanced UI is disabled. History search is not available.'));
      return;
    }

    const selected = await this.terminalInterface.startReverseSearch();
    
    if (selected) {
      console.log(chalk.green(`\n✅ Selected: ${selected}`));
      
      const { useCommand } = await inquirer.prompt([{
        type: 'confirm',
        name: 'useCommand',
        message: 'Use this command?',
        default: true
      }]);

      if (useCommand) {
        await this.processUserMessage(selected);
      }
    }
  }

  /**
   * Toggle enhanced UI on/off
   */
  private async toggleEnhancedUI(): Promise<void> {
    this.enhancedMode = !this.enhancedMode;
    
    console.log(chalk.blue(`🎨 Enhanced UI: ${this.enhancedMode ? 'ON' : 'OFF'}`));
    
    if (this.enhancedMode) {
      console.log(chalk.gray('Initializing enhanced terminal interface...'));
      try {
        this.terminalInterface = new TerminalInterfaceController();
        this.setupTerminalInterfaceListeners();
        await this.terminalInterface.initialize();
        await this.terminalInterface.startSession();
        console.log(chalk.green('✅ Enhanced UI enabled successfully.'));
      } catch (error: any) {
        console.log(chalk.red('❌ Failed to enable enhanced UI:', error.message));
        this.enhancedMode = false;
        this.terminalInterface = null;
      }
    } else {
      console.log(chalk.gray('Disabling enhanced terminal interface...'));
      if (this.terminalInterface) {
        await this.terminalInterface.stopSession();
        this.terminalInterface = null;
      }
      console.log(chalk.green('✅ Enhanced UI disabled. Using basic mode.'));
    }
  }

  /**
   * Set up terminal interface event listeners
   */
  private setupTerminalInterfaceListeners(): void {
    if (!this.terminalInterface) return;
    
    this.terminalInterface.on('reverse-search-requested', async () => {
      await this.searchHistory();
    });

    this.terminalInterface.on('editor-open-requested', async () => {
      await this.openEditor();
    });

    this.terminalInterface.on('command-selected', async (command: string) => {
      await this.processUserMessage(command);
    });
  }

  /**
   * Process a user message (used by enhanced features)
   */
  private async processUserMessage(message: string): Promise<void> {
    // This simulates the user typing a message and processing it
    console.log(chalk.cyan(`💬 You: ${message}`));
    
    // Check for special commands
    if (await this.handleSpecialCommands(message)) {
      return;
    }

    // Add to history
    if (this.enhancedMode && this.terminalInterface) {
      this.terminalInterface.addToHistory(message);
    }

    // Process the message
    if (this.terminalInterface) {
      this.terminalInterface.updateState('thinking', { 
        thinkingMessage: 'Processing your request...' 
      });
    }
    
    try {
      const response = await this.conversationEngine.processMessage(
        message,
        this.currentSessionId
      );

      if (this.terminalInterface) {
        this.terminalInterface.updateState('idle');
      }
      this.displayResponse(response);

      // Update metrics if available (placeholder for future metadata support)
      // if (response.metadata?.tokensUsed || response.metadata?.cost) {
      //   this.terminalInterface.updateSessionMetrics({
      //     tokensUsed: response.metadata.tokensUsed,
      //     costAccumulated: response.metadata.cost
      //   });
      // }

      // Handle action items if present
      if (response.requiresAction && response.cliCommands && response.cliCommands.length > 0) {
        await this.handleActionItems(response);
      }

    } catch (error: any) {
      if (this.terminalInterface) {
        this.terminalInterface.updateState('idle');
      }
      await this.handleProcessingError(error instanceof Error ? error : new Error(String(error)), message);
    }
  }

  // Helper methods for status line configuration

  private async toggleStatusComponent(statusLineManager: any, components: any[]): Promise<void> {
    const choices = components.map((comp: any, index: number) => ({
      name: `${comp.label} - ${comp.enabled ? 'enabled' : 'disabled'}`,
      value: comp.id
    }));

    const { componentId } = await inquirer.prompt([{
      type: 'list',
      name: 'componentId',
      message: 'Select component to toggle:',
      choices
    }]);

    statusLineManager.toggleComponent(componentId);
    console.log(chalk.green(`✅ Component "${componentId}" toggled.`));
  }

  private async addCustomStatusCommand(statusLineManager: any): Promise<void> {
    const { commandName, shellCommand, label } = await inquirer.prompt([
      {
        type: 'input',
        name: 'commandName',
        message: 'Component ID (unique identifier):',
        validate: (input: string) => input.trim().length > 0 || 'ID is required'
      },
      {
        type: 'input',
        name: 'label',
        message: 'Display label:',
        validate: (input: string) => input.trim().length > 0 || 'Label is required'
      },
      {
        type: 'input',
        name: 'shellCommand',
        message: 'Shell command to execute:',
        validate: (input: string) => input.trim().length > 0 || 'Command is required',
        transformer: (input: string) => {
          if (input.length > 50) {
            return input.substring(0, 47) + '...';
          }
          return input;
        }
      }
    ]);

    statusLineManager.addComponent({
      id: commandName,
      label,
      getValue: async () => await statusLineManager.executeShellCommand(shellCommand),
      command: shellCommand,
      enabled: true,
      order: 999,
      color: 'white'
    });

    console.log(chalk.green(`✅ Custom command "${commandName}" added to status line.`));
  }

  private getTimeAgo(timestamp: Date): string {
    const now = Date.now();
    const diff = now - timestamp.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  /**
   * Clear screen
   */
  private clearScreen(): void {
    console.clear();
    console.log(chalk.bold.blue('🚀 APIX AI Interactive Chat'));
    console.log('═'.repeat(80));
  }

  /**
   * Handle chat-level errors
   */
  private async handleChatError(error: Error): Promise<void> {
    console.log(chalk.red('\n💥 Chat system error occurred.'));
    console.log(chalk.yellow('Attempting to recover...'));

    // Try to recover with a new session
    try {
      this.currentSessionId = uuidv4();
      console.log(chalk.green('✅ Started fresh session. You can continue chatting.'));
    } catch (recoveryError) {
      console.log(chalk.red('❌ Unable to recover. Please restart the chat.'));
      this.isActive = false;
    }
  }

  /**
   * Get default user preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      preferredLLM: 'auto',
      verbosityLevel: 'detailed',
      technicalLevel: 'intermediate',
      focusAreas: [],
      communicationStyle: 'formal'
    };
  }
}

/**
 * Chat Options Interface
 */
export interface ChatOptions {
  sessionFile?: string;
  industry?: string;
  context?: Partial<EnterpriseContext>;
  verbose?: boolean;
  debug?: boolean;
  disableEnhancedUI?: boolean;
  enableStatusLine?: boolean;
  enableHistory?: boolean;
  cleanMode?: boolean;
}

export default ChatInterface;