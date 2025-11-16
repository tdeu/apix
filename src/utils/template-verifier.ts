// src/utils/template-verifier.ts
import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger';

export interface TemplateVerificationResult {
  verified: boolean;
  templatesPath: string;
  missingTemplates: string[];
  availableTemplates: string[];
  error?: string;
}

/**
 * Verify template directory and required templates exist
 */
export class TemplateVerifier {
  private static readonly REQUIRED_TEMPLATES = [
    'api/nextjs/tokens/create.hbs',
    'components/react/TokenManager.hbs',
    'components/react/WalletConnect.hbs',
    'hooks/react/useTokens.hbs',
    'hooks/react/useWallet.hbs',
    'utils/common/hedera-client.hbs',
    'utils/common/hts-operations.hbs'
  ];

  /**
   * Find templates directory (could be in multiple locations)
   */
  private static async findTemplatesDirectory(): Promise<string | null> {
    const possiblePaths = [
      // When running from source
      path.join(__dirname, '../../templates'),
      // When installed via npm (from node_modules)
      path.join(__dirname, '../../../templates'),
      // When linked locally
      path.join(process.cwd(), 'templates'),
      // Fallback to package root
      path.join(__dirname, '..', '..', 'templates')
    ];

    for (const templatePath of possiblePaths) {
      try {
        if (await fs.pathExists(templatePath)) {
          const stat = await fs.stat(templatePath);
          if (stat.isDirectory()) {
            logger.internal('debug', 'Templates directory found', { path: templatePath });
            return templatePath;
          }
        }
      } catch (error) {
        // Skip this path
        continue;
      }
    }

    return null;
  }

  /**
   * Verify templates are available
   */
  static async verify(): Promise<TemplateVerificationResult> {
    try {
      // Find templates directory
      const templatesPath = await this.findTemplatesDirectory();

      if (!templatesPath) {
        return {
          verified: false,
          templatesPath: '',
          missingTemplates: this.REQUIRED_TEMPLATES,
          availableTemplates: [],
          error: 'Templates directory not found. APIX may not be installed correctly.'
        };
      }

      // Check required templates
      const missingTemplates: string[] = [];
      const availableTemplates: string[] = [];

      for (const templatePath of this.REQUIRED_TEMPLATES) {
        const fullPath = path.join(templatesPath, templatePath);
        if (await fs.pathExists(fullPath)) {
          availableTemplates.push(templatePath);
        } else {
          missingTemplates.push(templatePath);
        }
      }

      const verified = missingTemplates.length === 0;

      if (!verified) {
        logger.warn('Some templates are missing', {
          missing: missingTemplates.length,
          total: this.REQUIRED_TEMPLATES.length
        });
      }

      return {
        verified,
        templatesPath,
        missingTemplates,
        availableTemplates,
        error: verified ? undefined : `${missingTemplates.length} required templates are missing`
      };
    } catch (error: any) {
      logger.error('Template verification failed', error);
      return {
        verified: false,
        templatesPath: '',
        missingTemplates: this.REQUIRED_TEMPLATES,
        availableTemplates: [],
        error: `Template verification error: ${error.message}`
      };
    }
  }

  /**
   * Get all available templates
   */
  static async listAllTemplates(): Promise<string[]> {
    const templatesPath = await this.findTemplatesDirectory();
    if (!templatesPath) {
      return [];
    }

    try {
      const templates: string[] = [];
      await this.recursiveTemplateSearch(templatesPath, templatesPath, templates);
      return templates;
    } catch (error) {
      logger.error('Failed to list templates', error);
      return [];
    }
  }

  /**
   * Recursively search for .hbs files
   */
  private static async recursiveTemplateSearch(
    baseDir: string,
    currentDir: string,
    templates: string[]
  ): Promise<void> {
    try {
      const items = await fs.readdir(currentDir);

      for (const item of items) {
        const itemPath = path.join(currentDir, item);
        const stat = await fs.stat(itemPath);

        if (stat.isDirectory()) {
          await this.recursiveTemplateSearch(baseDir, itemPath, templates);
        } else if (item.endsWith('.hbs')) {
          const relativePath = path.relative(baseDir, itemPath);
          templates.push(relativePath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  /**
   * Verify specific template exists
   */
  static async templateExists(templatePath: string): Promise<boolean> {
    const templatesDir = await this.findTemplatesDirectory();
    if (!templatesDir) {
      return false;
    }

    const fullPath = path.join(templatesDir, templatePath);
    return await fs.pathExists(fullPath);
  }

  /**
   * Get template path for use in generator
   */
  static async getTemplatePath(templatePath: string): Promise<string | null> {
    const templatesDir = await this.findTemplatesDirectory();
    if (!templatesDir) {
      return null;
    }

    const fullPath = path.join(templatesDir, templatePath);
    const exists = await fs.pathExists(fullPath);

    return exists ? fullPath : null;
  }

  /**
   * Display verification results to user
   */
  static displayResults(result: TemplateVerificationResult): void {
    if (result.verified) {
      logger.success(`Templates verified successfully (${result.availableTemplates.length} templates at ${result.templatesPath})`);
      return;
    }

    logger.error('Template verification failed');

    if (result.error) {
      logger.error(result.error);
    }

    if (result.missingTemplates.length > 0) {
      logger.warn('Missing templates:');
      result.missingTemplates.forEach(template => {
        logger.warn(`  - ${template}`);
      });

      logger.info('\nTo fix this issue:');
      logger.info('  1. Reinstall APIX: npm install -g apix-ai');
      logger.info('  2. Or run from source: npm install && npm run build');
    }
  }

  /**
   * Verify and throw if critical templates are missing
   */
  static async verifyOrThrow(): Promise<void> {
    const result = await this.verify();

    if (!result.verified) {
      this.displayResults(result);
      throw new Error(
        `Template verification failed: ${result.error || 'Required templates are missing'}`
      );
    }
  }
}
