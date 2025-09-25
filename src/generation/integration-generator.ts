import fs from 'fs-extra';
import path from 'path';
import { ProjectContext, IntegrationPlan, GeneratedFile, TemplateSelection, ConfigurationUpdate } from '../types';
import { TemplateEngine } from '../templates/template-engine';
import { PackageManager } from '../utils/package-manager';
import { logger } from '../utils/logger';

export interface GenerationResult {
  generatedFiles: GeneratedFile[];
  installedDependencies: string[];
  modifiedFiles: string[];
  nextSteps: string[];
}

export class IntegrationGenerator {
  private templateEngine: TemplateEngine;
  private packageManager: PackageManager;

  constructor() {
    this.templateEngine = new TemplateEngine();
    this.packageManager = new PackageManager(); // Will be set per project
  }

  async initialize(): Promise<void> {
    await this.templateEngine.loadTemplates();
    
    // Debug: List all loaded templates
    const templates = this.templateEngine.listTemplates();
    logger.debug(`Loaded ${templates.length} templates:`);
    templates.forEach(t => logger.debug(`  - ${t.id} (${t.category}/${t.framework})`));
  }

  async generateIntegration(
    plan: IntegrationPlan,
    context: ProjectContext
  ): Promise<GenerationResult> {
    const result: GenerationResult = {
      generatedFiles: [],
      installedDependencies: [],
      modifiedFiles: [],
      nextSteps: []
    };

    try {
      // Initialize package manager for this project
      this.packageManager = new PackageManager(context.rootPath);
      
      // Step 1: Install dependencies
      if (plan.dependencies.length > 0) {
        logger.info(`Installing ${plan.dependencies.length} dependencies...`);
        // Convert string array to dependency objects
        const deps = plan.dependencies.map(dep => ({
          name: dep,
          version: 'latest',
          type: 'dependencies' as const
        }));
        await this.packageManager.addDependencies(deps);
        result.installedDependencies = plan.dependencies;
        logger.success('✅ Dependencies installed successfully');
      }

      // Step 2: Generate files from templates
      logger.info(`Generating ${plan.templates.length} files from templates...`);
      
      // Use the template engine's helper to create proper context
      const baseContext = this.templateEngine.createContextFromProject(context, plan.options);
      const templateContext = {
        ...baseContext,
        hederaNetwork: 'testnet' as const // Override to ensure testnet
      };

      let generatedCount = 0;
      for (const selection of plan.templates) {
        generatedCount++;
        logger.info(`📝 Generating ${generatedCount}/${plan.templates.length}: ${selection.outputPath}`);
        try {
          const generatedFile = await this.templateEngine.generateFile(
            selection.templateId,
            templateContext,
            selection.outputPath
          );
          
          // Actually write the file to disk
          const fullPath = path.join(context.rootPath, generatedFile.path);
          await fs.ensureDir(path.dirname(fullPath));
          await fs.writeFile(fullPath, generatedFile.content, 'utf8');
          logger.success(`✅ Generated: ${selection.outputPath}`);
          
          result.generatedFiles.push(generatedFile);
        } catch (error) {
          logger.error(`❌ Failed to generate ${selection.outputPath}:`, error);
          throw error;
        }
      }

      // Step 3: Apply configuration updates
      if (plan.configuration.length > 0) {
        logger.info(`Updating ${plan.configuration.length} configuration files...`);
        for (const configUpdate of plan.configuration) {
          logger.info(`⚙️  Updating: ${configUpdate.file}`);
          await this.applyConfigUpdate(configUpdate, context);
          result.modifiedFiles.push(configUpdate.file);
          logger.success(`✅ Updated: ${configUpdate.file}`);
        }
      }

      // Step 4: Generate documentation
      logger.info('📚 Generating documentation...');
      // Documentation generation will be implemented later
      // await this.generateDocumentation(plan, context, result);
      
      // Step 5: Generate next steps
      result.nextSteps = this.generateNextSteps(plan, context, result);

      logger.success(`🎉 Integration completed! Generated ${result.generatedFiles.length} files`);
      return result;

    } catch (error) {
      logger.error('Integration generation failed:', error);
      throw error;
    }
  }

  private async applyConfigUpdate(
    configUpdate: ConfigurationUpdate,
    context: ProjectContext
  ): Promise<void> {
    const filePath = path.join(context.rootPath, configUpdate.file);

    try {
      // Handle environment file updates
      if (configUpdate.file === '.env.local' || configUpdate.file === '.env') {
        await this.updateEnvironmentFile(filePath, configUpdate.updates);
        return;
      }

      // Handle package.json updates
      if (configUpdate.file === 'package.json') {
        await this.updatePackageJson(filePath, configUpdate.updates);
        return;
      }

      // Handle other configuration files
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf-8');
        let updatedContent = content;

        // Apply text-based updates
        for (const [key, value] of Object.entries(configUpdate.updates)) {
          // Simple string replacement for now
          // This could be enhanced with AST manipulation for JS/TS files
          updatedContent = updatedContent.replace(
            new RegExp(`${key}\\s*=\\s*[^\\n]*`, 'g'),
            `${key} = ${value}`
          );
        }

        await fs.writeFile(filePath, updatedContent);
      } else {
        logger.warn(`Configuration file not found: ${filePath}`);
      }

    } catch (error) {
      logger.error(`Failed to update configuration file ${filePath}:`, error);
      throw error;
    }
  }

  private async updateEnvironmentFile(
    filePath: string,
    updates: Record<string, any>
  ): Promise<void> {
    let content = '';
    
    if (await fs.pathExists(filePath)) {
      content = await fs.readFile(filePath, 'utf-8');
    }

    // Parse existing environment variables
    const envVars = new Map<string, string>();
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          envVars.set(key.trim(), valueParts.join('=').trim());
        }
      }
    });

    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
      envVars.set(key, String(value));
    });

    // Generate new content
    const newContent = Array.from(envVars.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    await fs.writeFile(filePath, newContent);
  }

  private async updatePackageJson(
    filePath: string,
    updates: Record<string, any>
  ): Promise<void> {
    const packageJson = await fs.readJSON(filePath);

    // Deep merge updates
    Object.entries(updates).forEach(([key, value]) => {
      if (typeof value === 'object' && !Array.isArray(value)) {
        packageJson[key] = { ...packageJson[key], ...value };
      } else {
        packageJson[key] = value;
      }
    });

    await fs.writeJSON(filePath, packageJson, { spaces: 2 });
  }

  private generateNextSteps(
    plan: IntegrationPlan,
    context: ProjectContext,
    result: GenerationResult
  ): string[] {
    const steps: string[] = [];

    // Basic next steps based on integration type
    if (plan.type === 'hts') {
      steps.push('🎯 Your HTS integration is ready!');
      steps.push('📝 Update your Hedera account credentials in .env.local');
      steps.push('🚀 Start your development server: npm run dev');
      steps.push('🔗 Import and use the HTSManager in your components');
      
      if (result.generatedFiles.some(f => f.path.includes('TokenManager'))) {
        steps.push('📦 Use the TokenManager component in your app');
      }
    }

    if (plan.type === 'wallet') {
      steps.push('🎯 Your wallet integration is ready!');
      steps.push('📱 Wrap your app with WalletProvider');
      steps.push('🔌 Use the WalletConnect component');
      steps.push('🔧 Test with HashPack wallet extension');
    }

    // Framework-specific steps
    if (context.framework === 'next.js') {
      steps.push('📁 Check the generated API routes in /api');
      steps.push('🎨 Import components in your pages');
    }

    // General steps
    steps.push('📚 Read the generated README.md for detailed usage');
    steps.push('🧪 Run tests to ensure everything works');
    steps.push('🔍 Check the generated TypeScript definitions');

    return steps;
  }

  async generateFromTemplate(
    templateId: string,
    parameters: Record<string, any>,
    context: ProjectContext
  ): Promise<GenerationResult> {
    try {
      // Initialize if not already done
      await this.initialize();

      // Create template context from parameters and project context
      const templateContext = this.templateEngine.createContextFromProject(context, parameters);

      // Generate the file using the template engine
      const generatedFile = await this.templateEngine.generateFile(
        templateId,
        templateContext,
        `generated-${templateId}.ts` // Default output path
      );

      // Return a basic generation result
      return {
        generatedFiles: [generatedFile],
        installedDependencies: [],
        modifiedFiles: [],
        nextSteps: [`Generated file from template: ${templateId}`]
      };
    } catch (error) {
      logger.error(`Failed to generate from template ${templateId}:`, error);
      throw error;
    }
  }

  async validateIntegration(
    plan: IntegrationPlan,
    context: ProjectContext
  ): Promise<boolean> {
    // Validate that all required templates exist
    for (const selection of plan.templates) {
      const template = this.templateEngine.getTemplate(selection.templateId);
      if (!template) {
        logger.error(`Template not found: ${selection.templateId}`);
        return false;
      }
    }

    // Validate output paths don't conflict
    const outputPaths = plan.templates.map((s: TemplateSelection) => s.outputPath);
    const duplicates = outputPaths.filter((path: string, index: number) => outputPaths.indexOf(path) !== index);
    if (duplicates.length > 0) {
      logger.error('Duplicate output paths detected:', duplicates);
      return false;
    }

    // Validate dependencies are available
    // This could be enhanced to check npm registry

    return true;
  }
}

export const integrationGenerator = new IntegrationGenerator();