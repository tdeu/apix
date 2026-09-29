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
  import { HEDERA_SDK_VERSION_RANGE } from '../generation/dependency-versions';
  import { detectProjectLayout, ProjectLayout } from '../analysis/project-layout';
  import { apiRouteFile, moduleFile } from '../generation/module-paths';
  import { checkIntegrationSupport } from './support-policy';
  
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
      
      // Wallet integration recommendations
      const walletRecommendation = this.generateWalletRecommendation(context, projectType);
      if (walletRecommendation) recommendations.push(walletRecommendation);

      // Smart contract recommendations
      const contractRecommendation = this.generateContractRecommendation(context, projectType);
      if (contractRecommendation) recommendations.push(contractRecommendation);

      // Consensus service recommendations
      const consensusRecommendation = this.generateConsensusRecommendation(context, projectType);
      if (consensusRecommendation) recommendations.push(consensusRecommendation);
      
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

      // Same rules as the CLI, for any other caller of the planner
      const support = checkIntegrationSupport(type, context);
      if (support.error) {
        throw new Error(support.error);
      }

      const plan: IntegrationPlan = {
        type,
        context,
        options,
        templates: [],
        dependencies: [],
        newFiles: [],
        modifications: [],
        configuration: [],
        layout: await detectProjectLayout(context.rootPath, context.framework)
      };

      let resultPlan: IntegrationPlan;

      switch (type) {
        case 'hts':
          resultPlan = await this.createHTSPlan(plan);
          break;
        case 'wallet':
          resultPlan = await this.createWalletPlan(plan);
          break;
        case 'smart-contract':
          resultPlan = await this.createSmartContractPlan(plan);
          break;
        case 'consensus':
          resultPlan = await this.createConsensusPlan(plan);
          break;
        case 'account':
          resultPlan = await this.createAccountPlan(plan);
          break;
        default:
          throw new Error(`❌ Unsupported integration type: ${integrationType}\n\n✅ Supported types: hts, wallet, smart-contract, consensus, account\n\n💡 Example: apix add hts --name "MyToken" --symbol "MTK"`);
      }

      // Validate the plan has required templates
      this.validateIntegrationPlan(resultPlan);

      return resultPlan;
      } catch (error: any) {
        logger.error('Failed to create integration plan:', error.message);
        throw new Error(`Integration plan creation failed: ${error.message}`);
      }
    }

    private validateIntegrationPlan(plan: IntegrationPlan): void {
      // Check if plan has templates
      if (!plan.templates || plan.templates.length === 0) {
        logger.warn(`⚠️  Integration plan for ${plan.type} has no templates`);
        return;
      }

      // Validate template IDs exist (basic validation)
      const missingTemplates: string[] = [];

      for (const template of plan.templates) {
        if (!template.templateId) {
          missingTemplates.push('(empty template ID)');
        }
      }

      if (missingTemplates.length > 0) {
        logger.warn(`⚠️  Integration plan has invalid templates:`, missingTemplates);
      }

      logger.debug(`✅ Integration plan validated: ${plan.templates.length} templates, ${plan.dependencies.length} dependencies`);
    }

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
      
      // Add dependencies (server-only makes a client-side import of the
      // operator key a build error)
      plan.dependencies = context.framework === 'next.js' ? ['@hashgraph/sdk', 'server-only'] : ['@hashgraph/sdk'];
      
      // Select templates based on framework
      plan.templates = this.selectHTSTemplates(context.framework, htsConfig, plan.layout!);

      // Set output files based on templates
      plan.newFiles = plan.templates.map(t => ({
        path: t.outputPath,
        content: '', // Will be filled by template engine
        type: 'typescript',
        overwrite: false
      }));

      // Configuration updates
      plan.configuration = [];
      
        logger.debug('HTS plan created', { templates: plan.templates.length, files: plan.newFiles.length });
        return plan;
      } catch (error: any) {
        logger.error('Failed to create HTS plan:', error.message);
        throw new Error(`HTS plan creation failed: ${error.message}`);
      }
    }

    private async createWalletPlan(plan: IntegrationPlan): Promise<IntegrationPlan> {
      plan.type = 'wallet';
      // lib/hedera/wallet-service imports @hashgraph/sdk
      plan.dependencies = ['@hashgraph/sdk'];
      plan.templates = [
        {
          templateId: 'utils/common/wallet-service',
          templateType: 'utility',
          framework: plan.context.framework as any,
          outputPath: moduleFile(plan.layout!, 'wallet-service', '.ts'),
          variables: {
            network: 'testnet',
            walletTypes: ['hashpack', 'blade']
          }
        }
      ];

      if (plan.context.framework === 'next.js') {
        plan.templates.push({
          templateId: 'hooks/react/useWallet',
          templateType: 'hook',
          framework: 'next.js',
          outputPath: moduleFile(plan.layout!, 'use-wallet', '.ts'),
          variables: { network: 'testnet' }
        });

        plan.templates.push({
          templateId: 'components/react/ConnectWallet',
          templateType: 'component',
          framework: 'next.js',
          outputPath: moduleFile(plan.layout!, 'connect-wallet', '.tsx'),
          variables: { network: 'testnet' }
        });
      }

      plan.newFiles = this.newFilesFor(plan.templates);
      return plan;
    }

    private newFilesFor(templates: TemplateSelection[]): GeneratedFile[] {
      return templates.map(t => ({
        path: t.outputPath,
        content: '', // Filled by the template engine
        type: 'typescript',
        overwrite: false
      }));
    }

    private async createSmartContractPlan(plan: IntegrationPlan): Promise<IntegrationPlan> {
      plan.type = 'smart-contract';
      plan.templates = [
        {
          templateId: 'utils/common/hedera-client',
          templateType: 'utility',
          framework: plan.context.framework as any,
          outputPath: moduleFile(plan.layout!, 'hedera-client', '.ts'),
          variables: { network: 'testnet' }
        },
        {
          templateId: 'utils/common/smart-contract-operations',
          templateType: 'utility',
          framework: plan.context.framework as any,
          outputPath: moduleFile(plan.layout!, 'smart-contract-operations', '.ts'),
          variables: {
            network: 'testnet',
            contractLanguage: 'solidity'
          }
        }
      ];

      plan.dependencies.push('@hashgraph/sdk');
      if (plan.context.framework === 'next.js') {
        plan.dependencies.push('server-only');
      }
      plan.newFiles = this.newFilesFor(plan.templates);
      return plan;
    }

    private async createConsensusPlan(plan: IntegrationPlan): Promise<IntegrationPlan> {
      plan.type = 'consensus';
      const layout = plan.layout!;
      const framework = plan.context.framework;
      plan.templates = [
        {
          templateId: 'utils/common/hedera-client',
          templateType: 'utility',
          framework,
          outputPath: moduleFile(layout, 'hedera-client', '.ts'),
          variables: {}
        },
        {
          templateId: 'utils/common/consensus-operations',
          templateType: 'utility',
          framework,
          outputPath: moduleFile(layout, 'consensus-operations', '.ts'),
          variables: {}
        },
        ...['topics', 'messages'].map((route): TemplateSelection => ({
          templateId: `api/nextjs/consensus/${route}`,
          templateType: 'api',
          framework: 'next.js',
          outputPath: apiRouteFile(layout, `consensus/${route}`),
          variables: {}
        }))
      ];

      plan.dependencies.push('@hashgraph/sdk', 'server-only');
      plan.newFiles = this.newFilesFor(plan.templates);
      return plan;
    }

    private async createAccountPlan(plan: IntegrationPlan): Promise<IntegrationPlan> {
      plan.type = 'account';
      plan.templates = [];
      plan.newFiles = [];
      return plan;
    }

    // TODO: These methods are temporarily disabled due to syntax issues
    // They will be re-enabled once the structural problems are resolved

    private selectHTSTemplates(framework: string, config: HTSConfiguration, layout: ProjectLayout): TemplateSelection[] {
      const templates: TemplateSelection[] = [];

      // Core HTS utility template
      templates.push({
        templateId: 'utils/common/hts-operations',
        templateType: 'utility',
        framework: framework as any,
        outputPath: moduleFile(layout, 'hts-operations', '.ts'),
        variables: { ...config }
      });

      // Framework-specific templates
      switch (framework) {
        case 'next.js': {
          // Everything the routes and TokenManager import, so the output builds as-is
          const module = (templateId: string, templateType: TemplateSelection['templateType'], outputPath: string): TemplateSelection =>
            ({ templateId, templateType, framework: 'next.js', outputPath, variables: { ...config } });
          templates.push(
            module('utils/common/hedera-client', 'utility', moduleFile(layout, 'hedera-client', '.ts')),
            module('types/common/hedera-types', 'utility', moduleFile(layout, 'hedera-types', '.ts')),
            ...['create', 'info', 'mint', 'transfer'].map(route =>
              module(`api/nextjs/tokens/${route}`, 'api', apiRouteFile(layout, `tokens/${route}`))),
            module('hooks/react/useTokens', 'hook', moduleFile(layout, 'use-tokens', '.ts')),
            module('hooks/react/useWallet', 'hook', moduleFile(layout, 'use-wallet', '.ts')),
            module('components/ui/Button', 'component', moduleFile(layout, 'ui-button', '.tsx')),
            module('components/ui/Input', 'component', moduleFile(layout, 'ui-input', '.tsx')),
            module('components/ui/Card', 'component', moduleFile(layout, 'ui-card', '.tsx')),
            module('components/react/TransactionStatus', 'component', moduleFile(layout, 'transaction-status', '.tsx')),
            module('components/react/TokenManager', 'component', moduleFile(layout, 'token-manager', '.tsx'))
          );
          break;
        }

        case 'react':
          templates.push(
            {
              templateId: 'hooks/react/useTokenOperations',
              templateType: 'hook',
              framework: 'react',
              outputPath: moduleFile(layout, 'use-token-operations', '.ts'),
              variables: { ...config }
            },
            {
              templateId: 'components/react/TokenManager',
              templateType: 'component',
              framework: 'react',
              outputPath: moduleFile(layout, 'token-manager', '.tsx'),
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
            '@hashgraph/sdk': HEDERA_SDK_VERSION_RANGE
          }
        }
      });
      
      return updates;
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
              templateId: 'components/react/ConnectWallet',
              templateType: 'component',
              framework: framework as any,
              outputPath: 'components/ConnectWallet.tsx',
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
}
