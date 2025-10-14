import { logger } from '../utils/logger';

// Import HederaAgentKit at module level to avoid dynamic import issues
let HederaLangchainToolkit: any;
let AgentMode: any;
let coreTokenPlugin: any;
let coreAccountQueryPlugin: any;
let coreTokenQueryPlugin: any;

// Import Hedera SDK at module level
let Client: any;
let PrivateKey: any;

/**
 * Hedera Agent Kit Service
 * 
 * Provides real integration with HederaAgentKit for enhanced blockchain operations
 */

export interface HederaAgentKitConfig {
  accountId: string;
  privateKey: string;
  network: 'testnet' | 'mainnet';
}

export interface TokenCreationConfig {
  name: string;
  symbol: string;
  decimals?: number;
  initialSupply?: number;
  adminKey?: boolean;
  supplyKey?: boolean;
  freezeKey?: boolean;
  wipeKey?: boolean;
}

export interface AgentKitOperationResult {
  success: boolean;
  data?: any;
  error?: string;
  transactionId?: string;
  explorerUrl?: string;
}

export class HederaAgentKitService {
  private agentKit: any = null;
  private initialized: boolean = false;
  private config: HederaAgentKitConfig;

  constructor(config: HederaAgentKitConfig) {
    this.config = config;
  }

  /**
   * Load required modules using require() for better compatibility
   */
  private async loadModules(): Promise<void> {
    try {
      // Load HederaAgentKit using require() instead of dynamic import
      const agentKitModule = require('hedera-agent-kit');
      HederaLangchainToolkit = agentKitModule.HederaLangchainToolkit;
      AgentMode = agentKitModule.AgentMode;
      coreTokenPlugin = agentKitModule.coreTokenPlugin;
      coreAccountQueryPlugin = agentKitModule.coreAccountQueryPlugin;
      coreTokenQueryPlugin = agentKitModule.coreTokenQueryPlugin;
      
      // Load Hedera SDK
      const hederaSdk = require('@hashgraph/sdk');
      Client = hederaSdk.Client;
      PrivateKey = hederaSdk.PrivateKey;
      
      logger.internal('debug', 'Modules loaded successfully', {
        hederaToolkitAvailable: !!HederaLangchainToolkit,
        agentModeAvailable: !!AgentMode,
        pluginsLoaded: !!(coreTokenPlugin && coreAccountQueryPlugin && coreTokenQueryPlugin)
      });
      
    } catch (error: any) {
      logger.error('Failed to load required modules:', error);
      throw new Error(`Module loading failed: ${error.message}`);
    }
  }

  /**
   * Initialize HederaAgentKit with proper configuration
   */
  async initialize(): Promise<void> {
    try {
      // Load modules using require() for better compatibility
      await this.loadModules();
      
      if (!HederaLangchainToolkit) {
        throw new Error('HederaLangchainToolkit class not found in module exports');
      }
      
      // Create Hedera client
      const client = this.config.network === 'mainnet' 
        ? Client.forMainnet() 
        : Client.forTestnet();
        
      client.setOperator(
        this.config.accountId,
        PrivateKey.fromString(this.config.privateKey)
      );

      // Create HederaLangchainToolkit instance with v3 API
      this.agentKit = new HederaLangchainToolkit({
        client,
        configuration: {
          tools: [], // Load all tools from plugins
          context: {
            mode: AgentMode.AUTONOMOUS,
            accountId: this.config.accountId,
          },
          plugins: [
            coreAccountQueryPlugin,  // For account queries and balances
            coreTokenPlugin,         // For token operations
            coreTokenQueryPlugin,    // For token info queries
          ],
        },
      });

      this.initialized = true;

      logger.internal('info', 'HederaAgentKit initialized successfully', {
        network: this.config.network,
        accountId: this.config.accountId,
        toolsAvailable: this.agentKit.getTools().length
      });

    } catch (error: any) {
      logger.error('Failed to initialize HederaAgentKit', error);
      
      // Check if it's a missing package error vs configuration error
      if (error.code === 'MODULE_NOT_FOUND') {
        logger.warn('HederaAgentKit package not found - falling back to direct SDK operations');
      } else {
        logger.error('HederaAgentKit configuration error:', error.message);
      }
      
      this.agentKit = null;
      this.initialized = false;
    }
  }

  /**
   * Check if HederaAgentKit is available and initialized
   */
  isAvailable(): boolean {
    return this.initialized && this.agentKit !== null;
  }

  /**
   * Create token using HederaAgentKit v3 tools
   */
  async createToken(options: TokenCreationConfig): Promise<AgentKitOperationResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'HederaAgentKit not available - using fallback implementation'
      };
    }

    try {
      // Get the CREATE_FUNGIBLE_TOKEN_TOOL from the toolkit
      const tools = this.agentKit.getTools();
      const createTokenTool = tools.find((tool: any) => 
        tool.name === 'create_fungible_token_tool'
      );
      
      if (!createTokenTool) {
        throw new Error('CREATE_FUNGIBLE_TOKEN_TOOL not found in HederaAgentKit');
      }

      // Execute the tool with proper parameters - ensure all required fields are present
      const params = {
        name: options.name,
        symbol: options.symbol,
        decimals: options.decimals || 8,
        initialSupply: String(options.initialSupply || 1000000),
        // Add treasury account explicitly
        treasuryAccount: this.config.accountId
      };

      logger.internal('debug', 'Creating token with HederaAgentKit parameters:', params);
      
      const result = await createTokenTool._call(params);

      // Parse the result (HederaAgentKit returns JSON string)
      const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;

      logger.internal('info', 'Token created successfully via HederaAgentKit', {
        tokenId: parsedResult.tokenId,
        name: options.name,
        symbol: options.symbol
      });

      return {
        success: true,
        data: parsedResult,
        transactionId: parsedResult.transactionId,
        explorerUrl: this.getExplorerUrl('token', parsedResult.tokenId)
      };

    } catch (error: any) {
      logger.error('HederaAgentKit token creation failed', error);
      return {
        success: false,
        error: error.message || 'Token creation failed'
      };
    }
  }

  /**
   * Validate token operation using HederaAgentKit v3 tools
   */
  async validateTokenOperation(tokenId: string): Promise<AgentKitOperationResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'HederaAgentKit not available'
      };
    }

    try {
      // Get the GET_TOKEN_INFO_QUERY_TOOL from the toolkit
      const tools = this.agentKit.getTools();
      const getTokenInfoTool = tools.find((tool: any) => 
        tool.name === 'get_token_info_query_tool'
      );
      
      if (!getTokenInfoTool) {
        throw new Error('GET_TOKEN_INFO_QUERY_TOOL not found in HederaAgentKit');
      }

      // Execute the tool
      const result = await getTokenInfoTool._call({ tokenId });
      
      return {
        success: true,
        data: typeof result === 'string' ? JSON.parse(result) : result
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Token validation failed'
      };
    }
  }

  /**
   * Validate consensus operation using HederaAgentKit v3 tools
   */
  async validateConsensusOperation(topicId: string): Promise<AgentKitOperationResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'HederaAgentKit not available'
      };
    }

    try {
      // Get the GET_TOPIC_MESSAGES_QUERY_TOOL from the toolkit
      const tools = this.agentKit.getTools();
      const getTopicTool = tools.find((tool: any) => 
        tool.name === 'get_topic_messages_query_tool'
      );
      
      if (!getTopicTool) {
        throw new Error('GET_TOPIC_MESSAGES_QUERY_TOOL not found in HederaAgentKit');
      }

      // Execute the tool with basic parameters
      const result = await getTopicTool._call({ 
        topicId,
        limit: 1  // Just check if topic exists
      });
      
      return {
        success: true,
        data: typeof result === 'string' ? JSON.parse(result) : result
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Consensus validation failed'
      };
    }
  }

  /**
   * Create topic using HederaAgentKit v3 tools
   */
  async createTopic(memo: string = 'Created via APIX AI'): Promise<AgentKitOperationResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'HederaAgentKit not available'
      };
    }

    try {
      // Get the CREATE_TOPIC_TOOL from the toolkit
      const tools = this.agentKit.getTools();
      const createTopicTool = tools.find((tool: any) => 
        tool.name === 'create_topic_tool'
      );
      
      if (!createTopicTool) {
        throw new Error('CREATE_TOPIC_TOOL not found in HederaAgentKit');
      }

      // Execute the tool
      const result = await createTopicTool._call({ memo });
      const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
      
      return {
        success: true,
        data: parsedResult,
        transactionId: parsedResult.transactionId,
        explorerUrl: this.getExplorerUrl('transaction', parsedResult.transactionId)
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Topic creation failed'
      };
    }
  }

  /**
   * Validate account balance using HederaAgentKit v3 tools
   */
  async validateAccountBalance(accountId: string): Promise<AgentKitOperationResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'HederaAgentKit not available'
      };
    }

    try {
      // Get the GET_HBAR_BALANCE_QUERY_TOOL from the toolkit
      const tools = this.agentKit.getTools();
      const getBalanceTool = tools.find((tool: any) => 
        tool.name === 'get_hbar_balance_query_tool'
      );
      
      if (!getBalanceTool) {
        throw new Error('GET_HBAR_BALANCE_QUERY_TOOL not found in HederaAgentKit');
      }

      // Execute the tool
      const result = await getBalanceTool._call({ accountId });
      const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
      
      return {
        success: true,
        data: {
          accountId,
          balance: parsedResult.balance,
          tokens: parsedResult.tokens || []
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Account balance validation failed'
      };
    }
  }

  /**
   * Check if connected to Hedera network using HederaAgentKit v3 tools
   */
  async isConnected(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      // Test connection by getting account info
      const tools = this.agentKit.getTools();
      const getAccountTool = tools.find((tool: any) => 
        tool.name === 'get_account_query_tool'
      );
      
      if (!getAccountTool) {
        // No account tool available, assume connected if toolkit is initialized
        return true;
      }

      await getAccountTool._call({ accountId: this.config.accountId });
      return true;
    } catch (error) {
      logger.warn('HederaAgentKit connection test failed', error);
      return false;
    }
  }

  /**
   * Get explorer URL for different types of resources
   */
  private getExplorerUrl(type: 'token' | 'transaction' | 'account', id: string): string {
    const baseUrl = this.config.network === 'mainnet' 
      ? 'https://hashscan.io/mainnet' 
      : 'https://hashscan.io/testnet';
    
    return `${baseUrl}/${type}/${id}`;
  }

  /**
   * Get raw HederaLangchainToolkit instance for advanced operations
   */
  getAgentKit(): any {
    return this.agentKit;
  }
  
  /**
   * Get available tools from HederaAgentKit
   */
  getAvailableTools(): string[] {
    if (!this.isAvailable()) {
      return [];
    }
    
    return this.agentKit.getTools().map((tool: any) => tool.name);
  }
}