import fs from 'fs-extra';
import path from 'path';
import { ProjectContext, SupportedFramework, Dependency, ProjectStructure, ExistingIntegration } from '../types';
import { logger } from '../utils/logger';

export interface CompatibilityCheck {
  supported: boolean;
  framework?: SupportedFramework;
  message: string;
  suggestions: string[];
}

export class ProjectAnalyzer {
  private analysisCache: Map<string, { context: ProjectContext, timestamp: number }> = new Map();
  private cacheTimeout = 5000; // 5 seconds cache

  async analyzeProject(directory: string): Promise<ProjectContext> {
    try {
      const projectPath = path.resolve(directory);

      // Check cache first
      const cached = this.analysisCache.get(projectPath);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        logger.debug('Using cached project analysis');
        return cached.context;
      }
      
      // Check if directory exists and has package.json
      if (!await fs.pathExists(path.join(projectPath, 'package.json'))) {
        throw new Error('No package.json found. Make sure you\'re in a Node.js project directory.');
      }

      const packageJson = await fs.readJSON(path.join(projectPath, 'package.json'));
      
      // Validate compatibility first
      const compatibility = this.validateCompatibility(projectPath, packageJson);
      
      if (!compatibility.supported) {
        logger.warn('Unsupported project type detected');
        logger.info('APIX works best with:');
        compatibility.suggestions.forEach(suggestion => {
          logger.info(`  • ${suggestion}`);
        });
        
        throw new Error(compatibility.message);
      }
      
      // Detect framework
      const framework = this.detectFramework(packageJson);
      
      // Analyze dependencies
      const dependencies = this.analyzeDependencies(packageJson);
      const devDependencies = this.analyzeDevDependencies(packageJson);
      
      // Detect project structure
      const projectStructure = await this.analyzeProjectStructure(projectPath);
      
      // Detect existing integrations
      const existingIntegrations = await this.detectExistingIntegrations(projectPath, dependencies);
      
      // Detect package manager
      const packageManager = await this.detectPackageManager(projectPath);
      
      // Determine language
      const language = this.detectLanguage(projectPath, devDependencies);
      
      // Check for existing auth
      const hasExistingAuth = this.detectExistingAuth(dependencies);
      
      // Detect state management
      const hasStateManagement = this.detectStateManagement(dependencies);
      
      // Detect UI library
      const hasUILibrary = this.detectUILibrary(dependencies);

      const context: ProjectContext = {
        framework,
        language,
        packageManager,
        rootPath: projectPath,
        dependencies: [...dependencies, ...devDependencies],
        devDependencies,
        scripts: packageJson.scripts || {},
        hasExistingAuth,
        hasStateManagement,
        hasUILibrary,
        projectStructure,
        existingIntegrations
      };

      logger.debug('Project analysis complete:', context);

      // Cache the result
      this.analysisCache.set(projectPath, {
        context,
        timestamp: Date.now()
      });

      return context;

    } catch (error) {
      logger.error('Project analysis failed:', error);
      throw error;
    }
  }

  private validateCompatibility(projectPath: string, packageJson: any): CompatibilityCheck {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const hasReact = !!deps.react;
    const hasNext = !!deps.next;
    const hasVue = !!deps.vue;
    const hasAngular = !!deps['@angular/core'];
    const hasExpress = !!deps.express;
    const isCLI = !!packageJson.bin;
    const hasTypescript = !!deps.typescript || !!deps['@types/node'];

    // Check for CLI/Library projects (basic support)
    if (isCLI && hasTypescript) {
      return {
        supported: true,
        framework: 'node',
        message: 'CLI/Library project detected - basic analysis supported!',
        suggestions: []
      };
    }

    // Check for React/Next.js (fully supported)
    if (hasNext) {
      return {
        supported: true,
        framework: 'next.js',
        message: 'Next.js project detected - fully supported!',
        suggestions: []
      };
    }
    
    if (hasReact) {
      return {
        supported: true,
        framework: 'react',
        message: 'React project detected - fully supported!',
        suggestions: []
      };
    }
    
    // Check for Vue (experimental support)
    if (hasVue) {
      return {
        supported: false, // Change to true when Vue support is ready
        framework: 'vue',
        message: 'Vue.js detected - experimental support coming soon',
        suggestions: [
          'Create a Next.js project: npx create-next-app@latest my-hedera-app',
          'Create a React project: npx create-react-app my-hedera-app --template typescript',
          'Convert to React for full APIX support'
        ]
      };
    }
    
    // Unsupported frameworks
    if (hasAngular) {
      return {
        supported: false,
        message: 'Angular projects are not supported',
        suggestions: [
          'APIX specializes in React-based applications',
          'Create a Next.js project: npx create-next-app@latest my-hedera-app',
          'Create a React project: npx create-react-app my-hedera-app --template typescript'
        ]
      };
    }
    
    if (hasExpress) {
      return {
        supported: false, // Change to true when backend support is ready
        message: 'Express.js backend detected - frontend integration recommended',
        suggestions: [
          'Create a Next.js frontend: npx create-next-app@latest my-hedera-frontend',
          'Add React frontend to your Express app',
          'APIX works best with full-stack React applications'
        ]
      };
    }
    
    // No recognized framework
    return {
      supported: false,
      message: 'No supported framework detected',
      suggestions: [
        'APIX works best with modern React-based projects',
        'Create a Next.js app: npx create-next-app@latest my-hedera-app',
        'Create a React app: npx create-react-app my-hedera-app --template typescript',
        'Add React to your existing project'
      ]
    };
  }

  private detectFramework(packageJson: any): SupportedFramework {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.next) return 'next.js';
    if (deps.react && !deps.next) return 'react';
    if (deps.vue) return 'vue';
    if (deps['@angular/core']) return 'angular';
    if (deps.express) return 'express';
    if (packageJson.name && !deps.react && !deps.vue && !deps['@angular/core']) return 'node';
    
    return 'unknown';
  }

  private analyzeDependencies(packageJson: any): Dependency[] {
    const deps = packageJson.dependencies || {};
    return Object.entries(deps).map(([name, version]) => ({
      name,
      version: version as string,
      type: 'dependency' as const
    }));
  }

  private analyzeDevDependencies(packageJson: any): Dependency[] {
    const deps = packageJson.devDependencies || {};
    return Object.entries(deps).map(([name, version]) => ({
      name,
      version: version as string,
      type: 'devDependency' as const
    }));
  }

  private async analyzeProjectStructure(projectPath: string): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      hasApiRoutes: false,
      hasPages: false,
      hasComponents: false,
      hasHooks: false,
      hasContexts: false,
      hasUtils: false,
      hasStyles: false,
      directories: [],
      configFiles: []
    };

    try {
      const items = await fs.readdir(projectPath);
      structure.directories = items.filter(async item => {
        const stat = await fs.stat(path.join(projectPath, item));
        return stat.isDirectory();
      });

      // Check for common directories
      structure.hasApiRoutes = await fs.pathExists(path.join(projectPath, 'pages/api')) ||
                               await fs.pathExists(path.join(projectPath, 'app/api'));
      structure.hasPages = await fs.pathExists(path.join(projectPath, 'pages')) ||
                          await fs.pathExists(path.join(projectPath, 'app'));
      structure.hasComponents = await fs.pathExists(path.join(projectPath, 'components')) ||
                               await fs.pathExists(path.join(projectPath, 'src/components'));
      structure.hasHooks = await fs.pathExists(path.join(projectPath, 'hooks')) ||
                          await fs.pathExists(path.join(projectPath, 'src/hooks'));
      structure.hasContexts = await fs.pathExists(path.join(projectPath, 'contexts')) ||
                             await fs.pathExists(path.join(projectPath, 'src/contexts'));
      structure.hasUtils = await fs.pathExists(path.join(projectPath, 'utils')) ||
                          await fs.pathExists(path.join(projectPath, 'src/utils'));
      structure.hasStyles = await fs.pathExists(path.join(projectPath, 'styles')) ||
                           await fs.pathExists(path.join(projectPath, 'src/styles'));

      // Check for config files
      const configFiles = ['next.config.js', 'tailwind.config.js', 'tsconfig.json', '.env.local', '.env'];
      for (const file of configFiles) {
        if (await fs.pathExists(path.join(projectPath, file))) {
          structure.configFiles.push(file);
        }
      }

    } catch (error) {
      logger.warn('Error analyzing project structure:', error);
    }

    return structure;
  }

  private async detectExistingIntegrations(projectPath: string, dependencies: Dependency[]): Promise<ExistingIntegration[]> {
    const integrations: ExistingIntegration[] = [];
    
    // Detect HTS integration
    const htsIntegration = await this.detectHTSIntegration(projectPath, dependencies);
    if (htsIntegration) integrations.push(htsIntegration);

    // Detect Wallet integration
    const walletIntegration = await this.detectWalletIntegration(projectPath, dependencies);
    if (walletIntegration) integrations.push(walletIntegration);

    // Detect Account integration (basic Hedera SDK)
    const accountIntegration = await this.detectAccountIntegration(projectPath, dependencies);
    if (accountIntegration) integrations.push(accountIntegration);

    return integrations;
  }

  private async detectHTSIntegration(projectPath: string, dependencies: Dependency[]): Promise<ExistingIntegration | null> {
    const files: string[] = [];
    const htsSignatures = [
      'lib/hedera/hts-operations.ts',
      'lib/hedera/hts-operations.js',
      'hooks/useTokenOperations.ts',
      'hooks/useTokenOperations.js',
      'components/TokenManager.tsx',
      'components/TokenManager.jsx',
      'utils/hts-operations.ts',
      'utils/hts-operations.js'
    ];

    // Check for APix-generated HTS files
    for (const filePath of htsSignatures) {
      const fullPath = path.join(projectPath, filePath);
      if (await fs.pathExists(fullPath)) {
        files.push(filePath);
      }
    }

    // Check for HTS-specific imports in source files
    const htsImports = await this.scanForImportPatterns(projectPath, [
      'TokenCreateTransaction',
      'TokenMintTransaction',
      'TokenBurnTransaction',
      'useTokenOperations',
      'HTSManager'
    ]);

    if (files.length > 0 || htsImports.length > 0) {
      // Try to detect version from file content or comments
      const version = await this.detectIntegrationVersion(projectPath, files);
      
      return {
        type: 'hts',
        files: [...files, ...htsImports],
        active: files.length > 0,
        version
      };
    }

    return null;
  }

  private async detectWalletIntegration(projectPath: string, dependencies: Dependency[]): Promise<ExistingIntegration | null> {
    const files: string[] = [];
    const walletSignatures = [
      'contexts/WalletContext.tsx',
      'contexts/WalletContext.jsx',
      'hooks/useWallet.ts',
      'hooks/useWallet.js',
      'hooks/useWalletOperations.ts',
      'hooks/useWalletOperations.js',
      'components/WalletConnect.tsx',
      'components/WalletConnect.jsx',
      'components/WalletConnectionModal.tsx',
      'components/WalletConnectionModal.jsx'
    ];

    // Check for APix-generated wallet files
    for (const filePath of walletSignatures) {
      const fullPath = path.join(projectPath, filePath);
      if (await fs.pathExists(fullPath)) {
        files.push(filePath);
      }
    }

    // Check for wallet-specific dependencies
    const walletDeps = dependencies.filter(dep => 
      dep.name.includes('hashpack') || 
      dep.name.includes('walletconnect') ||
      dep.name.includes('blade') ||
      dep.name.includes('@walletconnect')
    );

    // Check for wallet-specific imports
    const walletImports = await this.scanForImportPatterns(projectPath, [
      'useWallet',
      'WalletProvider',
      'WalletContext',
      'HashpackConnectionProvider',
      'WalletConnectProvider'
    ]);

    if (files.length > 0 || walletDeps.length > 0 || walletImports.length > 0) {
      const version = await this.detectIntegrationVersion(projectPath, files);
      
      return {
        type: 'wallet',
        files: [...files, ...walletImports],
        active: files.length > 0 || walletDeps.length > 0,
        version
      };
    }

    return null;
  }

  private async detectAccountIntegration(projectPath: string, dependencies: Dependency[]): Promise<ExistingIntegration | null> {
    // Check for Hedera SDK
    const hasHederaSDK = dependencies.some(dep => dep.name === '@hashgraph/sdk');
    
    if (hasHederaSDK) {
      // Look for basic Hedera client usage
      const accountFiles = await this.scanForImportPatterns(projectPath, [
        'Client',
        'PrivateKey',
        'AccountId',
        'TransactionReceipt'
      ]);

      return {
        type: 'account',
        files: accountFiles,
        active: hasHederaSDK,
        version: dependencies.find(dep => dep.name === '@hashgraph/sdk')?.version
      };
    }

    return null;
  }

  private async scanForImportPatterns(projectPath: string, patterns: string[]): Promise<string[]> {
    const foundFiles: string[] = [];
    const commonPaths = ['src', 'lib', 'hooks', 'components', 'contexts', 'utils', 'pages', 'app'];
    
    for (const dir of commonPaths) {
      const dirPath = path.join(projectPath, dir);
      if (await fs.pathExists(dirPath)) {
        try {
          const files = await this.recursiveFileSearch(dirPath, ['.ts', '.tsx', '.js', '.jsx']);
          
          for (const file of files) {
            try {
              const content = await fs.readFile(file, 'utf-8');
              
              // Check for import patterns
              const hasPattern = patterns.some(pattern => {
                const importRegex = new RegExp(`import.*${pattern}.*from|import.*{.*${pattern}.*}.*from`, 'g');
                return importRegex.test(content);
              });
              
              if (hasPattern) {
                foundFiles.push(path.relative(projectPath, file));
              }
            } catch (error) {
              // Skip files that can't be read
              continue;
            }
          }
        } catch (error) {
          // Skip directories that can't be accessed
          continue;
        }
      }
    }

    return foundFiles;
  }

  private async recursiveFileSearch(dirPath: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules, .git, and other common ignore patterns
          if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(item)) {
            files.push(...await this.recursiveFileSearch(itemPath, extensions));
          }
        } else if (extensions.some(ext => item.endsWith(ext))) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be accessed
    }
    
    return files;
  }

  private async detectIntegrationVersion(projectPath: string, files: string[]): Promise<string | undefined> {
    // Try to find version in file comments or package.json
    for (const filePath of files) {
      try {
        const fullPath = path.join(projectPath, filePath);
        if (await fs.pathExists(fullPath)) {
          const content = await fs.readFile(fullPath, 'utf-8');
          
          // Look for version comments like "Generated with APIx v1.0.0"
          const versionMatch = content.match(/Generated with.*APIx.*v?([\d.]+)/i);
          if (versionMatch) {
            return versionMatch[1];
          }
          
          // Look for META comments with version
          const metaMatch = content.match(/META:.*"version":\s*"([^"]+)"/);
          if (metaMatch) {
            return metaMatch[1];
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    return undefined;
  }

  private async detectPackageManager(projectPath: string): Promise<'npm' | 'yarn' | 'pnpm'> {
    if (await fs.pathExists(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (await fs.pathExists(path.join(projectPath, 'yarn.lock'))) return 'yarn';
    return 'npm';
  }

  private detectLanguage(projectPath: string, devDependencies: Dependency[]): 'typescript' | 'javascript' {
    const hasTypeScript = devDependencies.some(dep => dep.name === 'typescript') ||
                         fs.pathExistsSync(path.join(projectPath, 'tsconfig.json'));
    return hasTypeScript ? 'typescript' : 'javascript';
  }

  private detectExistingAuth(dependencies: Dependency[]): boolean {
    const authLibs = ['next-auth', '@auth0/auth0-react', 'firebase', '@supabase/supabase-js', '@clerk/clerk-react'];
    return dependencies.some(dep => authLibs.includes(dep.name));
  }

  private detectStateManagement(dependencies: Dependency[]): ProjectContext['hasStateManagement'] {
    if (dependencies.some(dep => dep.name === '@reduxjs/toolkit' || dep.name === 'redux')) return 'redux';
    if (dependencies.some(dep => dep.name === 'zustand')) return 'zustand';
    if (dependencies.some(dep => dep.name === 'mobx')) return 'mobx';
    if (dependencies.some(dep => dep.name === 'recoil')) return 'recoil';
    return null;
  }

  private detectUILibrary(dependencies: Dependency[]): ProjectContext['hasUILibrary'] {
    if (dependencies.some(dep => dep.name === '@mui/material')) return 'material-ui';
    if (dependencies.some(dep => dep.name === '@chakra-ui/react')) return 'chakra-ui';
    if (dependencies.some(dep => dep.name === 'antd')) return 'ant-design';
    if (dependencies.some(dep => dep.name === 'tailwindcss')) return 'tailwindcss';
    if (dependencies.some(dep => dep.name === 'bootstrap')) return 'bootstrap';
    if (dependencies.some(dep => dep.name === 'styled-components')) return 'styled-components';
    return null;
  }

  async getIntegrationStatus(context: ProjectContext): Promise<Record<string, any>> {
    const status: Record<string, any> = {
      hts: { integrated: false, status: 'Not integrated', files: [], version: null },
      wallet: { integrated: false, status: 'Not integrated', files: [], version: null },
      account: { integrated: false, status: 'Not integrated', files: [], version: null },
      consensus: { integrated: false, status: 'Not integrated', files: [], version: null },
      'smart-contract': { integrated: false, status: 'Not integrated', files: [], version: null }
    };

    // Check for existing integrations
    context.existingIntegrations.forEach(integration => {
      status[integration.type] = {
        integrated: integration.active,
        status: integration.active ? 'Integrated' : 'Partially integrated',
        files: integration.files,
        version: integration.version || 'unknown',
        fileCount: integration.files.length
      };
    });

    return status;
  }

  isIntegrationInstalled(context: ProjectContext, integrationType: string): boolean {
    return context.existingIntegrations.some(
      integration => integration.type === integrationType && integration.active
    );
  }

  getIntegrationInfo(context: ProjectContext, integrationType: string): ExistingIntegration | null {
    return context.existingIntegrations.find(
      integration => integration.type === integrationType
    ) || null;
  }
}