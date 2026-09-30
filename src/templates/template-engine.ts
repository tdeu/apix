import Handlebars from 'handlebars';
import fs from 'fs-extra';
import path from 'path';
import { SupportedFramework, ProjectContext, TemplateSelection, GeneratedFile } from '../types';
import { logger } from '../utils/logger';
import { debugLogger } from '../utils/debug-logger';
import { relativeImport } from '../generation/module-paths';

export interface TemplateContext {
  projectName: string;
  framework: SupportedFramework;
  language: 'typescript' | 'javascript';
  packageManager: 'npm' | 'yarn' | 'pnpm';
  hederaNetwork: 'testnet' | 'mainnet';
  [key: string]: any;
}

export interface TemplateFile {
  id: string;
  name: string;
  path: string;
  template: string;
  framework: SupportedFramework;
  language: string;
  category: 'component' | 'api' | 'hook' | 'utility' | 'config' | 'type';
}

export class TemplateEngine {
  private handlebars: typeof Handlebars;
  private templatesPath: string;
  private loadedTemplates: Map<string, TemplateFile> = new Map();

  constructor() {
    this.handlebars = Handlebars.create();
    this.templatesPath = path.join(__dirname, '..', '..', 'templates');
    this.registerHelpers();
  }

  private registerHelpers(): void {
    // Helper to convert string to PascalCase
    this.handlebars.registerHelper('pascalCase', (str: string) => {
      return str.replace(/(?:^|\s|-|_)(\w)/g, (_, c) => c.toUpperCase()).replace(/[\s-_]/g, '');
    });

    // Helper to convert string to camelCase
    this.handlebars.registerHelper('camelCase', (str: string) => {
      const pascal = str.replace(/(?:^|\s|-|_)(\w)/g, (_, c) => c.toUpperCase()).replace(/[\s-_]/g, '');
      return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    });

    // Helper to convert string to kebab-case
    this.handlebars.registerHelper('kebabCase', (str: string) => {
      return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_]/g, '-');
    });

    // Helper for conditional logic based on framework
    this.handlebars.registerHelper('ifFramework', function(this: any, framework: string, expected: string, options: any) {
      return framework === expected ? options.fn(this) : options.inverse(this);
    });

    // Relative import from the file being generated to another generated
    // module, by logical id (see src/generation/module-paths.ts):
    //   import { htsManager } from '{{importFrom "hts-operations"}}';
    this.handlebars.registerHelper('importFrom', function(moduleId: string, options: Handlebars.HelperOptions) {
      const root = options.data?.root ?? {};
      const target = root.__modulePaths?.[moduleId];
      if (!root.__outputPath || !target) {
        throw new Error(
          `importFrom "${moduleId}": ${!root.__outputPath ? '__outputPath' : `module "${moduleId}"`} ` +
          'is not in the template context'
        );
      }
      return relativeImport(root.__outputPath, target);
    });

    // Block helper comparing a value, e.g. {{#ifEquals quotesStyle 'single'}}...{{else}}...{{/ifEquals}}
    // (Handlebars' built-in #if takes exactly one argument)
    this.handlebars.registerHelper('ifEquals', function(this: unknown, value: unknown, expected: unknown, options: Handlebars.HelperOptions) {
      return value === expected ? options.fn(this) : options.inverse(this);
    });

    // Helper for conditional logic based on language
    this.handlebars.registerHelper('ifLanguage', function(this: any, language: string, expected: string, options: any) {
      return language === expected ? options.fn(this) : options.inverse(this);
    });

    // Helper for file extensions
    this.handlebars.registerHelper('fileExtension', (language: string) => {
      return language === 'typescript' ? 'ts' : 'js';
    });

    // Helper for React file extensions
    this.handlebars.registerHelper('reactExtension', (language: string) => {
      return language === 'typescript' ? 'tsx' : 'jsx';
    });

    // Enhanced conditional helper for edge cases
    this.handlebars.registerHelper('conditional', function(this: any, condition: string, options: any) {
      const context = this;
      let result = false;

      switch (condition) {
        case 'typescript':
          result = context.hasTypeScript || context.language === 'typescript';
          break;
        case 'javascript':
          result = !context.hasTypeScript && context.language === 'javascript';
          break;
        case 'nextjs':
          result = context.hasNextJs || context.framework === 'next.js';
          break;
        case 'react':
          result = context.hasReact || context.framework?.includes('react');
          break;
        case 'app-router':
          result = context.usesAppRouter;
          break;
        case 'pages-router':
          result = context.usesPagesRouter;
          break;
        case 'has-wallet':
          result = context.hasExistingWallet;
          break;
        case 'has-hts':
          result = context.hasExistingHTS;
          break;
        default:
          result = false;
      }

      return result ? options.fn(this) : (options.inverse ? options.inverse(this) : '');
    });

    // Import path resolver helper
    this.handlebars.registerHelper('importPath', function(this: any, pathStr: string) {
      const context = this;
      
      // Simple path resolution with import prefix
      if (context.importPrefix && !pathStr.startsWith('.') && !pathStr.startsWith('@')) {
        return `${context.importPrefix}/${pathStr}`;
      }
      return pathStr;
    });

    // Enhanced file extension helper
    this.handlebars.registerHelper('fileExt', function(this: any, isComponent: boolean = false) {
      const context = this;
      if (context.hasTypeScript || context.language === 'typescript') {
        return isComponent ? '.tsx' : '.ts';
      }
      return isComponent ? '.jsx' : '.js';
    });

    // Helper for import/export syntax
    this.handlebars.registerHelper('importSyntax', function(moduleName: string, isDefault: boolean, language: string) {
      if (language === 'typescript') {
        return isDefault ? `import ${moduleName}` : `import { ${moduleName} }`;
      }
      return isDefault ? `const ${moduleName} = require` : `const { ${moduleName} } = require`;
    });

    // Helper for package manager commands
    this.handlebars.registerHelper('packageManager', function(command: string, manager: string) {
      const commands: Record<string, Record<string, string>> = {
        install: { npm: 'npm install', yarn: 'yarn add', pnpm: 'pnpm add' },
        dev: { npm: 'npm run dev', yarn: 'yarn dev', pnpm: 'pnpm dev' },
        build: { npm: 'npm run build', yarn: 'yarn build', pnpm: 'pnpm build' }
      };
      return commands[command]?.[manager] || `${manager} ${command}`;
    });
  }

  async loadTemplates(): Promise<void> {
    try {
      const categories = ['components', 'api', 'hooks', 'utils', 'types'];

      for (const category of categories) {
        const categoryPath = path.join(this.templatesPath, category);
        if (await fs.pathExists(categoryPath)) {
          await this.loadCategoryTemplates(category, categoryPath);
        }
      }

      logger.debug(`Loaded ${this.loadedTemplates.size} templates`);

      const unloaded = await this.findUnloadedTemplates();
      if (unloaded.length > 0) {
        logger.warn(`${unloaded.length} template file(s) can't be loaded (templates must live in <category>/<framework>/): ${unloaded.join(', ')}`);
      }
    } catch (error) {
      logger.error('Failed to load templates:', error);
      throw error;
    }
  }

  /**
   * .hbs files under templates/ that loadTemplates() did not pick up, relative
   * to the templates directory.
   */
  async findUnloadedTemplates(): Promise<string[]> {
    const loaded = new Set(Array.from(this.loadedTemplates.values()).map(t => path.resolve(t.path)));
    const walk = async (dir: string): Promise<string[]> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const nested = await Promise.all(entries.map(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : Promise.resolve([full]);
      }));
      return nested.flat();
    };
    if (!await fs.pathExists(this.templatesPath)) return [];
    return (await walk(this.templatesPath))
      .filter(file => file.endsWith('.hbs') && !loaded.has(path.resolve(file)))
      .map(file => path.relative(this.templatesPath, file).split(path.sep).join('/'))
      .sort();
  }

  private async loadCategoryTemplates(category: string, categoryPath: string): Promise<void> {
    try {
      const frameworks = await fs.readdir(categoryPath);
      
      for (const framework of frameworks) {
        const frameworkPath = path.join(categoryPath, framework);
        const stat = await fs.stat(frameworkPath);
        
        if (stat.isDirectory()) {
          await this.loadFrameworkTemplates(category, framework, frameworkPath);
        }
      }
    } catch (error) {
      logger.warn(`Failed to load templates from ${categoryPath}:`, error);
    }
  }

  private async loadFrameworkTemplates(category: string, framework: string, frameworkPath: string, subPath: string = ''): Promise<void> {
    try {
      const items = await fs.readdir(frameworkPath);
      
      for (const item of items) {
        const itemPath = path.join(frameworkPath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          // Recursively load templates from subdirectories
          const newSubPath = subPath ? `${subPath}/${item}` : item;
          await this.loadFrameworkTemplates(category, framework, itemPath, newSubPath);
        } else if (item.endsWith('.hbs')) {
          // Load template file
          const templateName = item.replace('.hbs', '');
          const templateId = subPath 
            ? `${category}/${framework}/${subPath}/${templateName}`
            : `${category}/${framework}/${templateName}`;
          
          const template = await fs.readFile(itemPath, 'utf8');
          
          // Extract metadata from template
          const metadata = this.extractTemplateMetadata(template);
          
          const templateFile: TemplateFile = {
            id: templateId,
            name: metadata.name || templateName,
            path: itemPath,
            template,
            framework: framework as SupportedFramework,
            language: metadata.language || 'typescript',
            category: category as TemplateFile['category']
          };
          
          this.loadedTemplates.set(templateId, templateFile);
        }
      }
    } catch (error) {
      logger.warn(`Failed to load framework templates from ${frameworkPath}:`, error);
    }
  }

  private extractTemplateMetadata(template: string): any {
    const metadataMatch = template.match(/{{!--\s*META:\s*({.*?})\s*--}}/s);
    if (metadataMatch) {
      try {
        return JSON.parse(metadataMatch[1]);
      } catch (error) {
        logger.warn('Invalid template metadata:', error);
      }
    }
    return {};
  }

  async generateFile(templateId: string, context: TemplateContext, outputPath: string): Promise<GeneratedFile> {
    try {
      const templateFile = this.loadedTemplates.get(templateId);
      if (!templateFile) {
        // Enhanced error message with available templates
        const availableTemplates = Array.from(this.loadedTemplates.keys()).filter(id =>
          id.includes(templateId.split('/').pop() || '')
        );

        let errorMessage = `❌ Template not found: ${templateId}`;
        if (availableTemplates.length > 0) {
          errorMessage += `\n\n💡 Did you mean one of these?\n${availableTemplates.map(t => `   • ${t}`).join('\n')}`;
        }
        errorMessage += `\n\n📚 Available templates: ${this.loadedTemplates.size} loaded`;
        errorMessage += `\n🔍 Searched for template at: templates/${templateId}.hbs`;

        throw new Error(errorMessage);
      }

      // Compile template
      const compiledTemplate = this.handlebars.compile(templateFile.template);
      
      // Generate content
      const content = compiledTemplate(context);
      
      // Clean up generated content (remove metadata comments)
      const cleanContent = content.replace(/{{!--\s*META:.*?--}}\s*/gs, '');
      
      const generatedFile: GeneratedFile = {
        path: outputPath,
        content: cleanContent,
        type: this.determineFileType(outputPath),
        overwrite: false
      };

      logger.debug(`Generated file from template ${templateId}:`, outputPath);
      return generatedFile;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Template not found')) {
        throw error; // Re-throw enhanced template not found errors
      }

      logger.error(`❌ Failed to generate file from template ${templateId}:`, error);
      throw new Error(`Template generation failed: ${templateId} → ${outputPath}\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\n🔧 Troubleshooting:\n   • Check template exists and syntax is valid\n   • Verify context variables match template requirements\n   • Ensure output path is writable`);
    }
  }

  async generateFiles(selections: TemplateSelection[], context: TemplateContext): Promise<GeneratedFile[]> {
    const generatedFiles: GeneratedFile[] = [];

    for (const selection of selections) {
      try {
        const mergedContext = { ...context, ...selection.variables };
        const generatedFile = await this.generateFile(
          selection.templateId,
          mergedContext,
          selection.outputPath
        );
        generatedFiles.push(generatedFile);
      } catch (error) {
        logger.error(`Failed to generate file from selection:`, selection);
        throw error;
      }
    }

    return generatedFiles;
  }

  getTemplatesByFramework(framework: SupportedFramework): TemplateFile[] {
    return Array.from(this.loadedTemplates.values()).filter(
      template => template.framework === framework || template.framework === ('common' as SupportedFramework)
    );
  }

  getTemplatesByCategory(category: TemplateFile['category']): TemplateFile[] {
    return Array.from(this.loadedTemplates.values()).filter(
      template => template.category === category
    );
  }

  getTemplate(templateId: string): TemplateFile | undefined {
    return this.loadedTemplates.get(templateId);
  }

  listTemplates(): TemplateFile[] {
    return Array.from(this.loadedTemplates.values());
  }

  private determineFileType(filePath: string): GeneratedFile['type'] {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
        return 'javascript';
      case '.json':
        return 'json';
      case '.env':
        return 'env';
      case '.md':
        return 'markdown';
      default:
        return 'typescript'; // Default fallback
    }
  }

  // Utility method to create context from project analysis
  createContextFromProject(projectContext: ProjectContext, additionalContext: Record<string, any> = {}): TemplateContext {
    const packageJson = path.join(projectContext.rootPath, 'package.json');
    let projectName = 'my-app';
    
    try {
      if (fs.existsSync(packageJson)) {
        const pkg = fs.readJSONSync(packageJson);
        projectName = pkg.name || path.basename(projectContext.rootPath);
      }
    } catch (error) {
      logger.warn('Could not read project name from package.json');
    }

    // Create enhanced context for better template handling
    try {
      const { TemplateEnhancer } = require('./template-enhancer');
      const enhancedContext = TemplateEnhancer.createEnhancedContext(projectContext, additionalContext);
      
      // Merge with legacy context for backward compatibility
      return {
        projectName,
        framework: projectContext.framework,
        language: projectContext.language,
        packageManager: projectContext.packageManager,
        hederaNetwork: 'testnet', // Default to testnet
        hasExistingAuth: projectContext.hasExistingAuth,
        hasStateManagement: projectContext.hasStateManagement,
        hasUILibrary: projectContext.hasUILibrary,
        projectStructure: projectContext.projectStructure,
        
        // Enhanced context properties
        ...enhancedContext,
        
        // Additional context overrides everything
        ...additionalContext
      };
    } catch (error) {
      logger.warn('Could not create enhanced template context, falling back to basic context:', error);
      
      // Fallback to basic context
      return {
        projectName,
        framework: projectContext.framework,
        language: projectContext.language,
        packageManager: projectContext.packageManager,
        hederaNetwork: 'testnet', // Default to testnet
        hasExistingAuth: projectContext.hasExistingAuth,
        hasStateManagement: projectContext.hasStateManagement,
        hasUILibrary: projectContext.hasUILibrary,
        projectStructure: projectContext.projectStructure,
        ...additionalContext
      };
    }
  }
}