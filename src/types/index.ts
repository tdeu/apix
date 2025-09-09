// Core Type Definitions

// CLI Command Options
export interface AnalysisOptions {
  directory: string;
  verbose?: boolean;
}

export interface IntegrationOptions {
  name?: string;
  symbol?: string;
  provider?: string;
  type?: string;
  force?: boolean;
}

// Project Analysis Types
export interface ProjectContext {
  framework: SupportedFramework;
  language: 'typescript' | 'javascript';
  packageManager: 'npm' | 'yarn' | 'pnpm';
  rootPath: string;
  dependencies: Dependency[];
  devDependencies: Dependency[];
  scripts: Record<string, string>;
  hasExistingAuth: boolean;
  hasStateManagement: StateManagementType | null;
  hasUILibrary: UILibraryType | null;
  projectStructure: ProjectStructure;
  existingIntegrations: ExistingIntegration[];
}

export interface Dependency {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency';
}

export type SupportedFramework = 
  | 'next.js'
  | 'react'
  | 'express'
  | 'vue'
  | 'angular'
  | 'node'
  | 'unknown';

export type StateManagementType = 
  | 'redux'
  | 'zustand'
  | 'context'
  | 'mobx'
  | 'recoil';

export type UILibraryType = 
  | 'material-ui'
  | 'chakra-ui'
  | 'ant-design'
  | 'tailwindcss'
  | 'bootstrap'
  | 'styled-components';

export interface ProjectStructure {
  hasApiRoutes: boolean;
  hasPages: boolean;
  hasComponents: boolean;
  hasHooks: boolean;
  hasContexts: boolean;
  hasUtils: boolean;
  hasStyles: boolean;
  directories: string[];
  configFiles: string[];
}

export interface ExistingIntegration {
  type: IntegrationType;
  files: string[];
  active: boolean;
  version?: string;
}

// Integration Types
export type IntegrationType = 
  | 'hts'
  | 'smart-contract'
  | 'wallet'
  | 'consensus'
  | 'account';

export interface IntegrationPlan {
  type: IntegrationType;
  context: ProjectContext;
  options: IntegrationOptions;
  templates: TemplateSelection[];
  dependencies: string[];
  newFiles: GeneratedFile[];
  modifications: FileModification[];
  configuration: ConfigurationUpdate[];
}

export interface TemplateSelection {
  templateId: string;
  templateType: 'component' | 'api' | 'hook' | 'utility' | 'config';
  framework: SupportedFramework;
  outputPath: string;
  variables: Record<string, any>;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'typescript' | 'javascript' | 'json' | 'env' | 'markdown';
  overwrite: boolean;
}

export interface FileModification {
  filePath: string;
  type: 'insert' | 'replace' | 'append';
  content: string;
  position?: number;
  searchPattern?: RegExp;
}

export interface ConfigurationUpdate {
  file: string;
  updates: Record<string, any>;
}

// Hedera-specific Types
export interface HederaConfiguration {
  network: 'testnet' | 'mainnet';
  accountId?: string;
  privateKey?: string;
  mirrorNodeUrl?: string;
  nodeId?: string;
}

export interface HTSConfiguration {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  treasuryAccountId?: string;
  autoRenewAccountId?: string;
  freezeDefault?: boolean;
  supplyType?: 'infinite' | 'finite';
  supplyKey?: boolean;
  adminKey?: boolean;
  freezeKey?: boolean;
  wipeKey?: boolean;
}

export interface SmartContractConfiguration {
  contractName: string;
  type: 'simple-token' | 'nft' | 'dao' | 'marketplace' | 'custom';
  deploymentType: 'native' | 'evm';
  constructorArgs?: any[];
  gas?: number;
}

export interface WalletConfiguration {
  providers: WalletProvider[];
  defaultProvider: WalletProvider;
  connectionFlow: 'modal' | 'redirect' | 'embedded';
}

export type WalletProvider = 
  | 'hashpack'
  | 'blade'
  | 'walletconnect'
  | 'metamask'
  | 'kabila';

// AI Planning Types
export interface IntegrationRecommendation {
  name: string;
  type: IntegrationType;
  description: string;
  command: string;
  priority: 'high' | 'medium' | 'low';
  benefits: string[];
  requirements: string[];
  estimatedTime: string;
}

// Configuration Types
export interface APIxConfig {
  version: string;
  hedera: HederaConfiguration;
  integrations: Record<IntegrationType, boolean>;
  preferences: {
    framework: SupportedFramework;
    language: 'typescript' | 'javascript';
    packageManager: 'npm' | 'yarn' | 'pnpm';
    codeStyle: 'standard' | 'prettier' | 'eslint';
  };
  templates: {
    customPaths: Record<string, string>;
    overrides: Record<string, any>;
  };
}

// Error Types
export interface APIxError extends Error {
  code: string;
  details?: any;
  suggestions?: string[];
}