import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { ConversationEngine } from '../ai/conversation/conversation-engine';
import { LimitationHandler } from '../ai/limitations/limitation-handler';
import { ErrorRecoverySystem } from '../ai/recovery/error-recovery-system';
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
  private currentSessionId: string;
  private userPreferences: UserPreferences;
  private isActive: boolean = false;

  constructor() {
    this.conversationEngine = new ConversationEngine();
    this.limitationHandler = new LimitationHandler();
    this.errorRecovery = new ErrorRecoverySystem();
    this.currentSessionId = uuidv4();
    this.userPreferences = this.getDefaultPreferences();
  }

  /**
   * Start interactive chat session
   */
  async startChat(options: ChatOptions = {}): Promise<void> {
    try {
      this.isActive = true;
      this.displayWelcome();

      // Load session if specified
      if (options.sessionFile) {
        await this.loadSession(options.sessionFile);
      }

      // Set enterprise context if provided
      const enterpriseContext = await this.gatherEnterpriseContext(options);

      // Start conversation
      const welcomeResponse = await this.conversationEngine.startSession(
        this.currentSessionId,
        enterpriseContext
      );

      this.displayResponse(welcomeResponse);

      // Main conversation loop
      await this.conversationLoop();

    } catch (error: any) {
      logger.error('Chat interface error:', error);
      console.log(chalk.red('\n❌ Chat session encountered an error. Please try again.'));

      // Attempt error recovery
      await this.handleChatError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isActive = false;
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

        // Process message with loading indicator
        const spinner = ora('🤖 Thinking...').start();
        
        try {
          const response = await this.conversationEngine.processMessage(
            userInput,
            this.currentSessionId
          );

          spinner.stop();
          this.displayResponse(response);

          // Handle action items if present
          if (response.requiresAction && response.cliCommands && response.cliCommands.length > 0) {
            await this.handleActionItems(response);
          }

        } catch (processingError: any) {
          spinner.stop();
          await this.handleProcessingError(processingError instanceof Error ? processingError : new Error(String(processingError)), userInput);
        }

      } catch (inputError) {
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
      // Use error recovery system
      const recovery = await this.errorRecovery.detectAndRecover(
        {
          type: 'cli-command',
          parameters: { command: command.command },
          originalRequirement: 'Execute CLI command',
          projectContext: {}
        },
        error
      );

      if (recovery.success) {
        console.log(chalk.green('\n✅ Error resolved automatically!'));
        console.log(recovery.message);
      } else {
        console.log(chalk.yellow('\n⚠️ Manual intervention required:'));
        recovery.recommendations.forEach(rec => {
          console.log(chalk.yellow(`   • ${rec}`));
        });
      }

    } catch (recoveryError) {
      console.log(chalk.red('\n❌ Error recovery failed. Please try manually or contact support.'));
    }
  }

  /**
   * Handle processing errors with graceful degradation
   */
  private async handleProcessingError(error: Error, userInput: string): Promise<void> {
    console.log(chalk.red('\n❌ I encountered an issue processing your request.'));

    // Attempt to classify and recover from the error
    try {
      const recovery = await this.errorRecovery.detectAndRecover(
        {
          type: 'conversation-processing',
          parameters: { userInput },
          originalRequirement: userInput,
          projectContext: {}
        },
        error
      );

      if (recovery.success) {
        console.log(chalk.green('✅ Recovered! Let me try a different approach...'));
        // Continue conversation with fallback response
      } else {
        console.log(chalk.yellow('⚠️ Please try:'));
        recovery.recommendations.forEach(rec => {
          console.log(chalk.yellow(`   • ${rec}`));
        });
      }

    } catch (recoveryError) {
      // Fallback to basic guidance
      console.log(chalk.yellow('Please try:'));
      console.log(chalk.yellow('   • Rephrasing your question'));
      console.log(chalk.yellow('   • Breaking complex requests into smaller parts'));
      console.log(chalk.yellow('   • Using specific CLI commands directly'));
      console.log(chalk.yellow('   • Type "/help" for assistance'));
    }
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
    console.clear();
    console.log(chalk.bold.blue('\n🚀 Welcome to APIX AI Interactive Chat!'));
    console.log(chalk.gray('Your intelligent Hedera development assistant\n'));
    
    console.log(chalk.white('💬 Start by describing your blockchain needs or asking questions'));
    console.log(chalk.white('⚡ I can generate code, explain concepts, and guide implementations'));
    console.log(chalk.white('🎯 I\'ll be transparent about my capabilities and limitations\n'));
    
    console.log(chalk.gray('Special commands: /help /save /exit /limitations'));
    console.log('═'.repeat(80));
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
}

export default ChatInterface;