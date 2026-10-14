import fs from 'fs-extra';
import path from 'path';
import { ProjectContext, IntegrationPlan, GeneratedFile, TemplateSelection, ConfigurationUpdate } from '../types';
import { TemplateEngine } from '../templates/template-engine';
import { generatedDependencyVersion, GENERATED_PACKAGE_OVERRIDES } from './dependency-versions';
import { modulePathMap } from './module-paths';
import { detectProjectLayout } from '../analysis/project-layout';
import { PackageManager, Dependency } from '../utils/package-manager';
import { logger } from '../utils/logger';

export interface GenerationResult {
  generatedFiles: GeneratedFile[];
  installedDependencies: string[];
  modifiedFiles: string[];
  nextSteps: string[];
  /** Existing files that differed and were replaced (only with force) */
  overwrittenFiles: string[];
  /** Existing files already identical to what would be generated (left alone) */
  unchangedFiles: string[];
}

export interface GenerationOptions {
  /** Overwrite existing files that differ from what would be generated */
  force?: boolean;
}

/** Thrown when generation would overwrite existing files and force is off */
export class FileConflictError extends Error {
  constructor(readonly conflicts: string[]) {
    super(
      `These files already exist and differ from what APIX would generate:\n` +
      conflicts.map(file => `  - ${file}`).join('\n') +
      '\nNothing was written. Re-run with --force to overwrite them.'
    );
  }
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
    context: ProjectContext,
    options: GenerationOptions = {}
  ): Promise<GenerationResult> {
    const result: GenerationResult = {
      generatedFiles: [],
      installedDependencies: [],
      modifiedFiles: [],
      nextSteps: [],
      overwrittenFiles: [],
      unchangedFiles: []
    };

    try {
      // Initialize package manager for this project
      this.packageManager = new PackageManager(context.rootPath);

      // Step 1: Render every file in memory first, so a template error
      // leaves the project untouched
      logger.info(`Generating ${plan.templates.length} files from templates...`);

      // Use the template engine's helper to create proper context
      const baseContext = this.templateEngine.createContextFromProject(context, plan.options);
      const layout = plan.layout ?? await detectProjectLayout(context.rootPath, context.framework);
      const templateContext = {
        ...baseContext,
        hederaNetwork: 'testnet' as const, // Override to ensure testnet
        __modulePaths: modulePathMap(layout)
      };

      const rendered: GeneratedFile[] = [];
      for (const selection of plan.templates) {
        rendered.push(await this.templateEngine.generateFile(
          selection.templateId,
          { ...templateContext, __outputPath: selection.outputPath },
          selection.outputPath
        ));
      }

      // Existing files: identical ones are left alone (e.g. lib/hedera/client.ts
      // from an earlier `apix add`); different ones are only replaced with force
      const toWrite: GeneratedFile[] = [];
      const conflicts: string[] = [];
      for (const file of rendered) {
        const fullPath = path.join(context.rootPath, file.path);
        if (!await fs.pathExists(fullPath)) {
          toWrite.push(file);
        } else if ((await fs.readFile(fullPath, 'utf8')) === file.content) {
          result.unchangedFiles.push(file.path);
        } else {
          conflicts.push(file.path);
          toWrite.push(file);
        }
      }
      if (conflicts.length > 0 && !options.force) {
        throw new FileConflictError(conflicts);
      }
      result.overwrittenFiles = conflicts;

      // Step 2: Install dependencies
      if (plan.dependencies.length > 0) {
        logger.info(`Installing ${plan.dependencies.length} dependencies...`);
        // Convert string array to dependency objects
        const deps = plan.dependencies.map(dep => ({
          name: dep,
          version: generatedDependencyVersion(dep),
          type: 'dependencies' as const
        }));
        await this.addDependenciesOrRestore(context.rootPath, deps);
        result.installedDependencies = plan.dependencies;
        logger.success('✅ Dependencies installed successfully');
      }

      // Step 3: Write the rendered files (new ones, plus conflicts under force)
      for (const [index, generatedFile] of toWrite.entries()) {
        logger.info(`📝 Writing ${index + 1}/${toWrite.length}: ${generatedFile.path}`);
        const fullPath = path.join(context.rootPath, generatedFile.path);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, generatedFile.content, 'utf8');
        logger.success(`✅ Generated: ${generatedFile.path}`);
        result.generatedFiles.push(generatedFile);
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
      // From everything this integration produced, written now or already present
      result.nextSteps = this.generateNextSteps(rendered);

      logger.success(`🎉 Integration completed! Generated ${result.generatedFiles.length} files`);
      return result;

    } catch (error) {
      logger.error('Integration generation failed:', error);
      throw error;
    }
  }

  /**
   * Add dependencies and run the install. If that fails, put package.json and
   * the lockfile back as they were before rethrowing.
   */
  private async addDependenciesOrRestore(rootPath: string, deps: Dependency[]): Promise<void> {
    const saved: Array<[string, string | null]> = [];
    for (const name of ['package.json', 'package-lock.json']) {
      const file = path.join(rootPath, name);
      saved.push([file, await fs.pathExists(file) ? await fs.readFile(file, 'utf8') : null]);
    }
    try {
      // Pin transitive packages (ws under ethers) to patched versions in the
      // generated project itself: APIX's own overrides don't reach it, and it
      // resolves the vulnerable versions @hiero-ledger/sdk pins otherwise. Written
      // before install so npm resolves the override; rolled back with the rest on
      // failure.
      await this.ensureGeneratedOverrides(rootPath);
      await this.packageManager.addDependencies(deps);
    } catch (error) {
      for (const [file, content] of saved) {
        if (content === null) {
          await fs.remove(file);
        } else {
          await fs.writeFile(file, content, 'utf8');
        }
      }
      throw error;
    }
  }

  /**
   * Merge GENERATED_PACKAGE_OVERRIDES into the generated project's package.json
   * as npm `overrides`, keeping any the project already declares.
   */
  private async ensureGeneratedOverrides(rootPath: string): Promise<void> {
    if (Object.keys(GENERATED_PACKAGE_OVERRIDES).length === 0) return;
    const packageJsonPath = path.join(rootPath, 'package.json');
    const pkg = await fs.readJSON(packageJsonPath);
    pkg.overrides = { ...(pkg.overrides ?? {}), ...GENERATED_PACKAGE_OVERRIDES };
    await fs.writeJSON(packageJsonPath, pkg, { spaces: 2 });
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

  /**
   * Next steps built only from the files this integration produced (written
   * or already up to date) and the environment variables they need.
   */
  private generateNextSteps(files: GeneratedFile[]): string[] {
    const steps: string[] = [];
    const paths = files.map(file => file.path.split(/[\\/]/).join('/'));

    // Server modules read the operator credentials at runtime
    if (files.some(file => file.content.includes('HEDERA_PRIVATE_KEY'))) {
      steps.push(
        'Set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in .env.local (server-side only, never NEXT_PUBLIC_). ' +
        'Get a free testnet account at https://portal.hedera.com/faucet'
      );
    }

    // API routes, with the HTTP methods they actually export
    for (const file of files) {
      const match = file.path.split(/[\\/]/).join('/').match(/(?:^|\/)app(\/api\/.*)\/route\.ts$/);
      if (!match) continue;
      const methods = Array.from(file.content.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)).map(m => m[1]);
      steps.push(`API route: ${methods.join(', ') || 'route'} ${match[1]}`);
    }

    // Top-level components (not the small building blocks under components/hedera/)
    for (const path of paths.filter(p => /\/components\/[^/]+\.tsx$/.test(p))) {
      const name = path.slice(path.lastIndexOf('/') + 1, -'.tsx'.length);
      steps.push(`Render <${name} /> (${path}) from a page`);
    }

    // Server-side helpers you can import from your own route handlers
    for (const path of paths.filter(p => /\/lib\/hedera\/[^/]+-operations\.ts$/.test(p))) {
      steps.push(`Server-side helpers: ${path}`);
    }

    steps.push('Start the dev server: npm run dev');
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
        nextSteps: [`Generated file from template: ${templateId}`],
        overwrittenFiles: [],
        unchangedFiles: []
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
