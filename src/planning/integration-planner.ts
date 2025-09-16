// src/planning/integration-planner.ts

import { 
    ProjectContext, 
    IntegrationPlan, 
    IntegrationOptions, 
    IntegrationType, 
    IntegrationRecommendation,
    TemplateSelection,
    GeneratedFile,
    ConfigurationUpdate,
    HTSConfiguration,
    SmartContractConfiguration,
    WalletConfiguration,
    WalletProvider
  } from '../types';
  import { logger } from '../utils/logger';
  
  export class IntegrationPlanner {
    
    /**
     * Generate AI-powered recommendations based on project context
     */
    async generateRecommendations(context: ProjectContext): Promise<IntegrationRecommendation[]> {
      try {
        logger.progress('Generating integration recommendations...');

        const recommendations: IntegrationRecommendation[] = [];
        const projectType = this.determineProjectType(context);
      
      // HTS Token Service recommendations
      const htsRecommendation = this.generateHTSRecommendation(context, projectType);
      if (htsRecommendation) recommendations.push(htsRecommendation);
      
      // Wallet integration recommendations (temporarily disabled)
      // const walletRecommendation = this.generateWalletRecommendation(context, projectType);
      // if (walletRecommendation) recommendations.push(walletRecommendation);

      // Smart contract recommendations (temporarily disabled)
      // const contractRecommendation = this.generateContractRecommendation(context, projectType);
      // if (contractRecommendation) recommendations.push(contractRecommendation);

      // Consensus service recommendations (temporarily disabled)
      // const consensusRecommendation = this.generateConsensusRecommendation(context, projectType);
      // if (consensusRecommendation) recommendations.push(consensusRecommendation);
      
      // Sort by priority
      recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
        logger.success(`Generated ${recommendations.length} recommendations`);
        return recommendations;
      } catch (error: any) {
        logger.error('Error generating recommendations:', error.message);
        return [];
      }
    }
  
    /**
     * Create detailed integration plan for specific integration type
     */
    async createIntegrationPlan(
      integrationType: string,
      options: IntegrationOptions,
      context: ProjectContext
    ): Promise<IntegrationPlan> {
      try {
        logger.progress(`Creating ${integrationType} integration plan...`);

      const type = integrationType as IntegrationType;

      const plan: IntegrationPlan = {
        type,
        context,
        options,
        templates: [],
        dependencies: [],
        newFiles: [],
        modifications: [],
        configuration: []
      };

      switch (type) {
        case 'hts':
          return await this.createHTSPlan(plan);
        case 'wallet':
          // Temporarily return basic plan (method disabled)
          plan.type = 'wallet';
          return plan;
        case 'smart-contract':
          // Temporarily return basic plan (method disabled)
          plan.type = 'smart-contract';
          return plan;
        case 'consensus':
          // Temporarily return basic plan (method disabled)
          plan.type = 'consensus';
          return plan;
        case 'account':
          // Temporarily return basic plan (method disabled)
          plan.type = 'account';
          return plan;
        default:
          throw new Error(`Unsupported integration type: ${integrationType}`);
      }
      } catch (error: any) {
        logger.error('Failed to create integration plan:', error.message);
        throw new Error(`Integration plan creation failed: ${error.message}`);
      }
    }

    /*
    // TODO: These methods are temporarily disabled due to syntax issues
    // They will be re-enabled once the structural problems are resolved

    private generateWalletRecommendation(
      context: ProjectContext,
      projectType: string
    ): IntegrationRecommendation | null {
      return {
        name: 'Wallet Integration',
        type: 'wallet',
        description: 'Connect user wallets for seamless Hedera interactions',
        command: 'wallet',
        priority: 'high',
        benefits: [
          'User-friendly wallet connections',
          'Support for HashPack, Blade, and WalletConnect',
          'Secure transaction signing'
        ],
        requirements: [
          'Frontend application',
          'User authentication system'
        ],
        estimatedTime: '3-8 minutes'
      };
    }

    private generateContractRecommendation(
      context: ProjectContext,
      projectType: string
    ): IntegrationRecommendation | null {
      return {
        name: 'Smart Contract Integration',
        type: 'smart-contract',
        description: 'Deploy and interact with Hedera smart contracts',
        command: 'smart-contract',
        priority: 'medium',
        benefits: [
          'Custom business logic on blockchain',
          'EVM compatibility',
          'Gas-efficient operations'
        ],
        requirements: [
          'Solidity knowledge',
          'Contract deployment setup'
        ],
        estimatedTime: '10-20 minutes'
      };
    }

    private generateConsensusRecommendation(
      context: ProjectContext,
      projectType: string
    ): IntegrationRecommendation | null {
      return {
        name: 'Consensus Service (HCS)',
        type: 'consensus',
        description: 'Add tamper-proof audit trails and messaging',
        command: 'consensus',
        priority: 'low',
        benefits: [
          'Immutable audit trails',
          'Secure messaging',
          'Compliance logging'
        ],
        requirements: [
          'Data logging needs',
          'Compliance requirements'
        ],
        estimatedTime: '5-12 minutes'
      };
    }

    // Missing plan creation methods
    /*
    private createWalletPlan(plan: IntegrationPlan): IntegrationPlan {
      // TODO: Implement wallet plan creation
      plan.type = 'wallet';
      plan.templates = [];
      plan.newFiles = [];
      return plan;
    }

    private createSmartContractPlan(plan: IntegrationPlan): IntegrationPlan {
      // TODO: Implement smart contract plan creation
      plan.type = 'smart-contract';
      plan.templates = [];
      plan.newFiles = [];
      return plan;
    }

    private createConsensusPlan(plan: IntegrationPlan): IntegrationPlan {
      // TODO: Implement consensus plan creation
      plan.type = 'consensus';
      plan.templates = [];
      plan.newFiles = [];
      return plan;
    }

    private createAccountPlan(plan: IntegrationPlan): IntegrationPlan {
      // TODO: Implement account plan creation
      plan.type = 'account';
      plan.templates = [];
      plan.newFiles = [];
      return plan;
    }
    */

    // Project Type Analysis
    private determineProjectType(context: ProjectContext): 'web-app' | 'api' | 'mobile' | 'desktop' | 'cli' {
      if (context.framework === 'express' && !context.projectStructure.hasPages) {
        return 'api';
      }
      
      if (['next.js', 'react', 'vue', 'angular'].includes(context.framework)) {
        return 'web-app';
      }
      
      if (context.framework === 'node') {
        // Check for CLI indicators
        if (context.dependencies.some(dep => dep.name === 'commander' || dep.name === 'yargs')) {
          return 'cli';
        }
        return 'api';
      }
      
      return 'web-app';
    }
  
    // HTS Integration Planning
    private generateHTSRecommendation(
      context: ProjectContext, 
      projectType: string
    ): IntegrationRecommendation | null {
      
      // Skip if already has HTS integration
      if (context.existingIntegrations.some(int => int.type === 'hts')) {
        return null;
      }
      
      const useCase = this.detectHTSUseCase(context);
      
      return {
        name: `Hedera Token Service (${useCase})`,
        type: 'hts',
        description: `Add native token functionality for ${useCase.toLowerCase()}`,
        command: 'hts',
        priority: useCase === 'Loyalty System' ? 'high' : 'medium',
        benefits: [
          'Native token creation and management',
          'Low-cost transactions',
          'Built-in compliance features',
          'Enterprise-grade security'
        ],
        requirements: [
          'Hedera testnet account',
          'Basic understanding of token economics'
        ],
        estimatedTime: '2-5 minutes'
      };
    }
  
    private detectHTSUseCase(context: ProjectContext): string {
      const allDeps = [...context.dependencies, ...context.devDependencies];
      const depNames = allDeps.map(dep => dep.name.toLowerCase());
      
      if (depNames.some(name => name.includes('ecommerce') || name.includes('shop'))) {
        return 'Loyalty System';
      }
      
      if (depNames.some(name => name.includes('game') || name.includes('nft'))) {
        return 'Gaming Tokens';
      }
      
      if (depNames.some(name => name.includes('dao') || name.includes('governance'))) {
        return 'Governance Token';
      }
      
      return 'Utility Token';
    }
  
    private async createHTSPlan(plan: IntegrationPlan): Promise<IntegrationPlan> {
      try {
        const { context, options } = plan;
      
      // Configure HTS settings
      const htsConfig: HTSConfiguration = {
        name: options.name || 'MyToken',
        symbol: options.symbol || 'MTK',
        decimals: 8,
        initialSupply: '1000000',
        supplyType: 'finite',
        supplyKey: true,
        adminKey: true
      };
      
      // Add dependencies
      plan.dependencies = ['@hashgraph/sdk'];
      
      // Simplified template generation for MVP
      plan.templates = [];
      plan.newFiles = [];
      plan.configuration = [];
      
        logger.debug('HTS plan created', { templates: plan.templates.length, files: plan.newFiles.length });
        return plan;
      } catch (error: any) {
        logger.error('Failed to create HTS plan:', error.message);
        throw new Error(`HTS plan creation failed: ${error.message}`);
      }
    }

    /*
    // TODO: These methods are temporarily disabled due to syntax issues
    // They will be re-enabled once the structural problems are resolved

    private selectHTSTemplates(framework: string, config: HTSConfiguration): TemplateSelection[] {
      const templates: TemplateSelection[] = [];
      
      // Core HTS utility template
      templates.push({
        templateId: 'utils/common/hts-operations',
        templateType: 'utility',
        framework: framework as any,
        outputPath: 'lib/hedera/hts-operations.ts',
        variables: { ...config }
      });
      
      // Framework-specific templates
      switch (framework) {
        case 'next.js':
          templates.push(
            {
              templateId: 'api/nextjs/tokens/create',
              templateType: 'api',
              framework: 'next.js',
              outputPath: 'app/api/tokens/create/route.ts',
              variables: { tokenName: config.name, symbol: config.symbol }
            },
            {
              templateId: 'api/nextjs/tokens/info',
              templateType: 'api',
              framework: 'next.js',
              outputPath: 'app/api/tokens/info/route.ts',
              variables: { tokenName: config.name, symbol: config.symbol }
            },
            {
              templateId: 'components/react/TokenManager',
              templateType: 'component',
              framework: 'next.js',
              outputPath: 'components/TokenManager.tsx',
              variables: { ...config }
            }
          );
          break;
          
        case 'react':
          templates.push(
            {
              templateId: 'hooks/react/useTokenOperations',
              templateType: 'hook',
              framework: 'react',
              outputPath: 'hooks/useTokenOperations.ts',
              variables: { ...config }
            },
            {
              templateId: 'components/react/TokenManager',
              templateType: 'component',
              framework: 'react',
              outputPath: 'components/TokenManager.tsx',
              variables: { ...config }
            }
          );
          break;
      }
      
      return templates;
    }
  
    private async generateHTSFiles(context: ProjectContext, config: HTSConfiguration): Promise<GeneratedFile[]> {
      const files: GeneratedFile[] = [];
      
      // Core HTS utility file
      files.push({
        path: 'lib/hedera/hts.ts',
        content: this.generateHTSUtilityContent(config),
        type: 'typescript',
        overwrite: false
      });
      
      // Type definitions
      files.push({
        path: 'types/token.ts',
        content: this.generateTokenTypesContent(config),
        type: 'typescript',
        overwrite: false
      });
      
      // Environment template
      files.push({
        path: '.env.example',
        content: this.generateHTSEnvContent(),
        type: 'env',
        overwrite: false
      });
      
      return files;
    }
  
    private generateHTSConfiguration(context: ProjectContext): ConfigurationUpdate[] {
      const updates: ConfigurationUpdate[] = [];
      
      // Update package.json with new dependencies
      updates.push({
        file: 'package.json',
        updates: {
          dependencies: {
            '@hashgraph/sdk': '^2.40.0'
          }
        }
      });
      
      return updates;
    }
  
    // Wallet Integration Planning
    private generateWalletRecommendation(
      context: ProjectContext, 
      projectType: string
    ): IntegrationRecommendation | null {
      
      if (context.existingIntegrations.some(int => int.type === 'wallet')) {
        return null;
      }
      
      // Only recommend for web applications
      if (projectType !== 'web-app') {
        return null;
      }
      
      return {
        name: 'Wallet Integration',
        type: 'wallet',
        description: 'Connect users with Hedera wallets (HashPack, Blade, etc.)',
        command: 'wallet',
        priority: 'high',
        benefits: [
          'Seamless user authentication',
          'Transaction signing capabilities',
          'Multi-wallet support',
          'Responsive wallet detection'
        ],
        requirements: [
          'HTTPS in production',
          'Web3 wallet users'
        ],
        estimatedTime: '1-3 minutes'
      };
    }
  
    private async createWalletPlan(plan: IntegrationPlan): Promise<IntegrationPlan> {
      const { context, options } = plan;
      
      // Determine optimal wallet providers based on context
      const walletConfig: WalletConfiguration = {
        providers: this.selectOptimalWalletProviders(context),
        defaultProvider: 'hashpack',
        connectionFlow: 'modal'
      };
      
      plan.dependencies = ['@hashgraph/sdk'];
      plan.templates = this.selectWalletTemplates(context.framework, walletConfig);
      plan.newFiles = await this.generateWalletFiles(context, walletConfig);
      
      return plan;
    }
  
    private selectOptimalWalletProviders(context: ProjectContext): WalletProvider[] {
      const providers: WalletProvider[] = ['hashpack']; // Always include HashPack as primary
      
      // Add Blade for mobile-responsive projects
      if (context.hasUILibrary === 'tailwindcss' || context.framework === 'next.js') {
        providers.push('blade');
      }
      
      // Add MetaMask if EVM features are detected
      const hasEVMLibs = context.dependencies.some(dep => 
        dep.name.includes('ethers') || dep.name.includes('web3')
      );
      if (hasEVMLibs) {
        providers.push('metamask');
      }
      
      return providers;
    }
  
    private selectWalletTemplates(framework: string, config: WalletConfiguration): TemplateSelection[] {
      const templates: TemplateSelection[] = [];
      
      // Core wallet service
      templates.push({
        templateId: 'utils/common/wallet-service',
        templateType: 'utility',
        framework: framework as any,
        outputPath: 'lib/hedera/wallet-service.ts',
        variables: { ...config }
      });
      
      // Framework-specific templates
      switch (framework) {
        case 'next.js':
        case 'react':
          templates.push(
            {
              templateId: 'contexts/react/WalletContext',
              templateType: 'component',
              framework: framework as any,
              outputPath: 'contexts/WalletContext.tsx',
              variables: { ...config }
            },
            {
              templateId: 'components/react/WalletConnectionModal',
              templateType: 'component',
              framework: framework as any,
              outputPath: 'components/WalletConnectionModal.tsx',
              variables: { ...config }
            },
            {
              templateId: 'components/react/WalletConnect',
              templateType: 'component',
              framework: framework as any,
              outputPath: 'components/WalletConnect.tsx',
              variables: { ...config }
            }
          );
          break;
      }
      
      return templates;
    }
  
    private async generateWalletFiles(context: ProjectContext, config: WalletConfiguration): Promise<GeneratedFile[]> {
      const files: GeneratedFile[] = [];
      
      // Core wallet utility
      files.push({
        path: 'lib/hedera/wallet.ts',
        content: this.generateWalletUtilityContent(config),
        type: 'typescript',
        overwrite: false
      });
      
      return files;
    }
  
    // Smart Contract Integration Planning
    private generateContractRecommendation(
      context: ProjectContext, 
      projectType: string
    ): IntegrationRecommendation | null {
      
      const contractUseCase = this.detectContractUseCase(context);
      if (!contractUseCase) return null;
      
      return {
        name: `Smart Contract (${contractUseCase})`,
        type: 'smart-contract',
        description: `Deploy ${contractUseCase.toLowerCase()} smart contract`,
        command: 'contract',
        priority: 'medium',
        benefits: [
          'Automated business logic',
          'Trustless operations',
          'EVM compatibility option',
          'Gas optimization'
        ],
        requirements: [
          'Smart contract knowledge',
          'Gas budget planning'
        ],
        estimatedTime: '5-15 minutes'
      };
    }
  
    private detectContractUseCase(context: ProjectContext): string | null {
      const allDeps = [...context.dependencies, ...context.devDependencies];
      const depNames = allDeps.map(dep => dep.name.toLowerCase());
      
      if (depNames.some(name => name.includes('marketplace') || name.includes('auction'))) {
        return 'Marketplace';
      }
      
      if (depNames.some(name => name.includes('dao') || name.includes('governance'))) {
        return 'DAO';
      }
      
      if (depNames.some(name => name.includes('nft') || name.includes('collectible'))) {
        return 'NFT Collection';
      }
      
      if (depNames.some(name => name.includes('defi') || name.includes('swap'))) {
        return 'DeFi Protocol';
      }
      
      return null;
    }
  
    private async createSmartContractPlan(plan: IntegrationPlan): Promise<IntegrationPlan> {
      const { context, options } = plan;
      
      const contractConfig: SmartContractConfiguration = {
        contractName: options.name || 'MyContract',
        type: (options.type as any) || 'simple-token',
        deploymentType: this.determineDeploymentType(context),
        gas: 300000
      };
      
      plan.dependencies = ['@hashgraph/sdk'];
      if (contractConfig.deploymentType === 'evm') {
        plan.dependencies.push('ethers');
      }
      
      plan.templates = this.selectContractTemplates(context.framework, contractConfig);
      plan.newFiles = await this.generateContractFiles(context, contractConfig);
      
      return plan;
    }
  
    private determineDeploymentType(context: ProjectContext): 'native' | 'evm' {
      // Check for EVM libraries in dependencies
      const hasEVMLibs = context.dependencies.some(dep => 
        dep.name.includes('ethers') || dep.name.includes('web3') || dep.name.includes('hardhat')
      );
      
      return hasEVMLibs ? 'evm' : 'native';
    }
  
    private selectContractTemplates(framework: string, config: SmartContractConfiguration): TemplateSelection[] {
      const templates: TemplateSelection[] = [];
      
      // Contract deployment script
      templates.push({
        templateId: 'contract-deploy',
        templateType: 'utility',
        framework: framework as any,
        outputPath: 'scripts/deploy-contract.ts',
        variables: { ...config }
      });
      
      // Contract interaction utility
      templates.push({
        templateId: 'contract-interaction',
        templateType: 'utility',
        framework: framework as any,
        outputPath: 'lib/hedera/contracts.ts',
        variables: { ...config }
      });
      
      return templates;
    }
  
    private async generateContractFiles(context: ProjectContext, config: SmartContractConfiguration): Promise<GeneratedFile[]> {
      const files: GeneratedFile[] = [];
      
      // Contract deployment script
      files.push({
        path: 'scripts/deploy-contract.ts',
        content: this.generateContractDeployContent(config),
        type: 'typescript',
        overwrite: false
      });
      
      return files;
    }
  
    // Consensus Service Integration Planning
    private generateConsensusRecommendation(
      context: ProjectContext, 
      projectType: string
    ): IntegrationRecommendation | null {
      
      // Detect if the project could benefit from consensus service
      const needsAuditTrail = this.detectAuditTrailNeeds(context);
      if (!needsAuditTrail) return null;
      
      return {
        name: 'Consensus Service (HCS)',
        type: 'consensus',
        description: 'Add immutable logging and audit trails',
        command: 'consensus',
        priority: 'low',
        benefits: [
          'Immutable message ordering',
          'Audit trail capabilities',
          'Regulatory compliance',
          'Data integrity verification'
        ],
        requirements: [
          'Understanding of consensus mechanisms',
          'Message structuring plan'
        ],
        estimatedTime: '3-8 minutes'
      };
    }
  
    private detectAuditTrailNeeds(context: ProjectContext): boolean {
      const allDeps = [...context.dependencies, ...context.devDependencies];
      const depNames = allDeps.map(dep => dep.name.toLowerCase());
      
      return depNames.some(name => 
        name.includes('audit') || 
        name.includes('log') || 
        name.includes('tracking') ||
        name.includes('compliance')
      );
    }
  
    private async createConsensusPlan(plan: IntegrationPlan): Promise<IntegrationPlan> {
      const { context, options } = plan;
      
      plan.dependencies = ['@hashgraph/sdk'];
      plan.templates = [{
        templateId: 'consensus-service',
        templateType: 'utility',
        framework: context.framework,
        outputPath: 'lib/hedera/consensus.ts',
        variables: { topicName: options.name || 'AuditTopic' }
      }];
      
      plan.newFiles = [{
        path: 'lib/hedera/consensus.ts',
        content: this.generateConsensusServiceContent(),
        type: 'typescript',
        overwrite: false
      }];
      
      return plan;
    }
  
    // Account Management Planning
    private async createAccountPlan(plan: IntegrationPlan): Promise<IntegrationPlan> {
      const { context, options } = plan;
      
      plan.dependencies = ['@hashgraph/sdk'];
      plan.templates = [{
        templateId: 'account-management',
        templateType: 'utility',
        framework: context.framework,
        outputPath: 'lib/hedera/accounts.ts',
        variables: {}
      }];
      
      plan.newFiles = [{
        path: 'lib/hedera/accounts.ts',
        content: this.generateAccountManagementContent(),
        type: 'typescript',
        overwrite: false
      }];
      
      return plan;
    }
  
    // Content generation methods (simplified for MVP)
    private generateHTSUtilityContent(config: HTSConfiguration): string {
      return `// HTS Utility Functions
  import { Client, TokenCreateTransaction, TokenInfoQuery } from '@hashgraph/sdk';
  
  export class HTSManager {
    private client: Client;
  
    constructor(client: Client) {
      this.client = client;
    }
  
    async createToken() {
      const tokenCreateTransaction = new TokenCreateTransaction()
        .setTokenName('${config.name}')
        .setTokenSymbol('${config.symbol}')
        .setDecimals(${config.decimals})
        .setInitialSupply(${config.initialSupply});
  
      const response = await tokenCreateTransaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      return receipt.tokenId;
    }
  
    async getTokenInfo(tokenId: string) {
      const query = new TokenInfoQuery().setTokenId(tokenId);
      return await query.execute(this.client);
    }
  }`;
    }
  
    private generateTokenTypesContent(config: HTSConfiguration): string {
      return `// Token Type Definitions
  export interface TokenInfo {
    tokenId: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  }
  
  export interface CreateTokenRequest {
    name: string;
    symbol: string;
    decimals?: number;
    initialSupply?: string;
  }`;
    }
  
    private generateHTSEnvContent(): string {
      return `# Hedera Token Service Configuration
  HEDERA_NETWORK=testnet
  HEDERA_ACCOUNT_ID=0.0.123
  HEDERA_PRIVATE_KEY=your-private-key-here
  HEDERA_MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com`;
    }
  
    private generateWalletUtilityContent(config: WalletConfiguration): string {
      return `// Wallet Connection Utility
  export class WalletManager {
    private providers = ${JSON.stringify(config.providers, null, 2)};
  
    async connectWallet(provider: string) {
      // Wallet connection logic here
      console.log(\`Connecting to \${provider}...\`);
    }
  
    async disconnectWallet() {
      // Wallet disconnection logic here
      console.log('Disconnecting wallet...');
    }
  }`;
    }
  
    private generateContractDeployContent(config: SmartContractConfiguration): string {
      return `// Smart Contract Deployment Script
  import { Client, FileCreateTransaction, ContractCreateTransaction } from '@hashgraph/sdk';
  
  export async function deployContract(client: Client, bytecode: string) {
    // Create file with contract bytecode
    const fileCreateTx = new FileCreateTransaction()
      .setContents(bytecode);
  
    const fileResponse = await fileCreateTx.execute(client);
    const fileReceipt = await fileResponse.getReceipt(client);
    const bytecodeFileId = fileReceipt.fileId;
  
    // Create contract
    const contractCreateTx = new ContractCreateTransaction()
      .setBytecodeFileId(bytecodeFileId)
      .setGas(${config.gas});
  
    const contractResponse = await contractCreateTx.execute(client);
    const contractReceipt = await contractResponse.getReceipt(client);
    
    return contractReceipt.contractId;
  }`;
    }
  
    private generateConsensusServiceContent(): string {
      return `// Consensus Service Utility
  import { Client, TopicCreateTransaction, TopicMessageSubmitTransaction } from '@hashgraph/sdk';
  
  export class ConsensusService {
    private client: Client;
    private topicId?: string;
  
    constructor(client: Client) {
      this.client = client;
    }
  
    async createTopic(memo: string) {
      const transaction = new TopicCreateTransaction().setTopicMemo(memo);
      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      this.topicId = receipt.topicId?.toString();
      return this.topicId;
    }
  
    async submitMessage(message: string) {
      if (!this.topicId) throw new Error('Topic not created');
      
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(this.topicId)
        .setMessage(message);
  
      return await transaction.execute(this.client);
    }
  }`;
    }
  
    private generateAccountManagementContent(): string {
      return `// Account Management Utility
  import { Client, AccountCreateTransaction, Hbar } from '@hashgraph/sdk';
  
  export class AccountManager {
    private client: Client;
  
    constructor(client: Client) {
      this.client = client;
    }
  
    async createAccount(initialBalance: number = 1000) {
      const transaction = new AccountCreateTransaction()
        .setInitialBalance(Hbar.fromTinybars(initialBalance));
  
      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      return receipt.accountId;
    }
  }`;
    }
  }    */
}
