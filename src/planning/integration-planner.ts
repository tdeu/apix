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
          'Token rules enforced by the network, not by contract code'
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
}
