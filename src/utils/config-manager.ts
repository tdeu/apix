// src/utils/config-manager.ts

import * as fs from 'fs-extra';
import * as path from 'path';
import { APIxConfig, HederaConfiguration } from '@/types';
import { logger } from './logger';

export class ConfigurationManager {
  private configPath: string;
  private config: APIxConfig | null = null;

  constructor(configPath: string = '.apix/config.json') {
    this.configPath = configPath;
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<APIxConfig> {
    try {
      if (await this.exists()) {
        const configData = await fs.readJson(this.configPath);
        this.config = this.validateConfig(configData);
        return this.config;
      } else {
        return this.getDefaultConfig();
      }
    } catch (error) {
      logger.warn('Failed to load config, using defaults', error);
      return this.getDefaultConfig();
    }
  }

  async save(config: Partial<APIxConfig>): Promise<void> {
    try {
      const currentConfig = await this.load();
      const updatedConfig = { ...currentConfig, ...config };
      
      // Ensure directory exists
      await fs.ensureDir(path.dirname(this.configPath));
      
      // Save configuration
      await fs.writeJson(this.configPath, updatedConfig, { spaces: 2 });
      
      this.config = updatedConfig;
      logger.debug('Configuration saved', { path: this.configPath });
      
    } catch (error) {
      logger.error('Failed to save configuration', error);
      throw error;
    }
  }

  async get(): Promise<APIxConfig> {
    if (!this.config) {
      this.config = await this.load();
    }
    return this.config;
  }

  async update(updates: Partial<APIxConfig>): Promise<void> {
    const currentConfig = await this.get();
    const updatedConfig = this.deepMerge(currentConfig, updates);
    await this.save(updatedConfig);
  }

  async getHederaConfig(): Promise<HederaConfiguration> {
    const config = await this.get();
    return config.hedera;
  }

  async updateHederaConfig(hederaConfig: Partial<HederaConfiguration>): Promise<void> {
    await this.update({ hedera: hederaConfig });
  }

  private getDefaultConfig(): APIxConfig {
    return {
      version: '1.0.0',
      hedera: {
        network: 'testnet',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
      },
      integrations: {
        hts: false,
        'smart-contract': false,
        wallet: false,
        consensus: false,
        account: false
      },
      preferences: {
        framework: 'next.js',
        language: 'typescript',
        packageManager: 'npm',
        codeStyle: 'prettier'
      },
      templates: {
        customPaths: {},
        overrides: {}
      }
    };
  }

  private validateConfig(config: any): APIxConfig {
    // Basic validation - in production, you'd use a schema validator like Joi or Zod
    const defaultConfig = this.getDefaultConfig();
    
    return {
      version: config.version || defaultConfig.version,
      hedera: {
        network: config.hedera?.network || defaultConfig.hedera.network,
        accountId: config.hedera?.accountId,
        privateKey: config.hedera?.privateKey,
        mirrorNodeUrl: config.hedera?.mirrorNodeUrl || defaultConfig.hedera.mirrorNodeUrl,
        nodeId: config.hedera?.nodeId
      },
      integrations: {
        ...defaultConfig.integrations,
        ...(config.integrations || {})
      },
      preferences: {
        ...defaultConfig.preferences,
        ...(config.preferences || {})
      },
      templates: {
        ...defaultConfig.templates,
        ...(config.templates || {})
      }
    };
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Reset configuration to defaults
   */
  async reset(): Promise<void> {
    this.config = null;
    if (await this.exists()) {
      await fs.remove(this.configPath);
    }
    logger.info('Configuration reset to defaults');
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Validate Hedera configuration
   */
  async validateHederaConfig(): Promise<{ valid: boolean; errors: string[] }> {
    const hederaConfig = await this.getHederaConfig();
    const errors: string[] = [];

    // Check network
    if (!['testnet', 'mainnet'].includes(hederaConfig.network)) {
      errors.push('Invalid network. Must be "testnet" or "mainnet"');
    }

    // Check account ID format if provided
    if (hederaConfig.accountId && !/^\d+\.\d+\.\d+$/.test(hederaConfig.accountId)) {
      errors.push('Invalid account ID format. Must be in format "0.0.123"');
    }

    // Check mirror node URL
    if (hederaConfig.mirrorNodeUrl && !hederaConfig.mirrorNodeUrl.startsWith('https://')) {
      errors.push('Mirror node URL must use HTTPS');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Export configuration for backup
   */
  async exportConfig(): Promise<string> {
    const config = await this.get();
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration from backup
   */
  async importConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson);
      const validatedConfig = this.validateConfig(config);
      await this.save(validatedConfig);
      logger.success('Configuration imported successfully');
    } catch (error) {
      logger.error('Failed to import configuration', error);
      throw new Error('Invalid configuration format');
    }
  }

  /**
   * Create or update .env.local file with Hedera configuration
   */
  async createEnvFile(): Promise<void> {
    try {
      const config = await this.get();
      const projectRoot = path.dirname(path.dirname(this.configPath)); // Go up from .apix to project root
      const envPath = path.join(projectRoot, '.env.local');
      
      const envContent = this.generateEnvContent(config);
      
      // Check if .env.local already exists
      const envExists = await fs.pathExists(envPath);
      if (envExists) {
        // Merge with existing content
        const existingContent = await fs.readFile(envPath, 'utf8');
        const updatedContent = this.mergeEnvContent(existingContent, envContent);
        await fs.writeFile(envPath, updatedContent);
      } else {
        await fs.writeFile(envPath, envContent);
      }
      
      logger.debug('Environment file created/updated:', envPath);
    } catch (error) {
      logger.error('Failed to create environment file:', error);
      throw error;
    }
  }

  private generateEnvContent(config: APIxConfig): string {
    const { hedera } = config;
    
    return `# APIx - Hedera Configuration
# Generated on ${new Date().toISOString()}

# Hedera Network Configuration
HEDERA_NETWORK=${hedera.network}
HEDERA_MIRROR_NODE_URL=${hedera.mirrorNodeUrl}
${hedera.nodeId ? `HEDERA_NODE_ID=${hedera.nodeId}` : '# HEDERA_NODE_ID=0.0.3'}

# Hedera Account Credentials
# Replace with your actual account ID and private key
HEDERA_ACCOUNT_ID=${hedera.accountId || '0.0.YOUR_ACCOUNT_ID'}
HEDERA_PRIVATE_KEY=${hedera.privateKey || 'YOUR_PRIVATE_KEY_HERE'}

# Next.js Public Environment Variables (if using Next.js)
NEXT_PUBLIC_HEDERA_NETWORK=${hedera.network}
NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL=${hedera.mirrorNodeUrl}
`;
  }

  private mergeEnvContent(existing: string, newContent: string): string {
    const existingLines = existing.split('\n');
    const newLines = newContent.split('\n');
    
    // Extract key-value pairs from new content
    const newEnvVars = new Map<string, string>();
    newLines.forEach(line => {
      if (line.includes('=') && !line.startsWith('#') && !line.trim().startsWith('#')) {
        const [key, ...values] = line.split('=');
        newEnvVars.set(key.trim(), values.join('=').trim());
      }
    });
    
    // Update existing lines or add new ones
    const updatedLines: string[] = [];
    const addedKeys = new Set<string>();
    
    existingLines.forEach(line => {
      if (line.includes('=') && !line.trim().startsWith('#')) {
        const [key] = line.split('=');
        const keyName = key.trim();
        
        if (newEnvVars.has(keyName)) {
          updatedLines.push(`${keyName}=${newEnvVars.get(keyName)}`);
          addedKeys.add(keyName);
        } else {
          updatedLines.push(line);
        }
      } else {
        updatedLines.push(line);
      }
    });
    
    // Add new environment variables that weren't in the existing file
    if (newEnvVars.size > addedKeys.size) {
      updatedLines.push(''); // Add blank line
      updatedLines.push('# APIx - Added Configuration');
      newEnvVars.forEach((value, key) => {
        if (!addedKeys.has(key)) {
          updatedLines.push(`${key}=${value}`);
        }
      });
    }
    
    return updatedLines.join('\n');
  }

  /**
   * Update integration status
   */
  async updateIntegration(integration: string, enabled: boolean): Promise<void> {
    try {
      const config = await this.get();
      config.integrations[integration as keyof typeof config.integrations] = enabled;
      await this.save(config);
      logger.debug(`Integration ${integration} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error('Failed to update integration status:', error);
      throw error;
    }
  }
}