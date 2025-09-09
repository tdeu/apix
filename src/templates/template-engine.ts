import Handlebars from 'handlebars';
import fs from 'fs-extra';
import path from 'path';
import { SupportedFramework, ProjectContext, TemplateSelection, GeneratedFile } from '@/types';
import { logger } from '@utils/logger';

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
    this.handlebars.registerHelper('ifFramework', function(framework: string, expected: string, options: any) {
      return framework === expected ? options.fn(this) : options.inverse(this);
    });

    // Helper for conditional logic based on language
    this.handlebars.registerHelper('ifLanguage', function(language: string, expected: string, options: any) {
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
      const categories = ['components', 'api', 'hooks', 'utils', 'configs', 'types'];
      
      for (const category of categories) {
        const categoryPath = path.join(this.templatesPath, category);
        if (await fs.pathExists(categoryPath)) {
          await this.loadCategoryTemplates(category, categoryPath);
        }
      }
      
      logger.debug(`Loaded ${this.loadedTemplates.size} templates`);
    } catch (error) {
      logger.error('Failed to load templates:', error);
      throw error;
    }
  }

  private async loadCategoryTemplates(category: string, categoryPath: string): Promise<void> {
    try {
      const frameworks = await fs.readdir(categoryPath);
      
      for (const framework of frameworks) {
        const frameworkPath = path.join(categoryPath, framework);
        const stat = await fs.stat(frameworkPath);
        
        if (stat.isDirectory()) {
          const templateFiles = await fs.readdir(frameworkPath);
          
          for (const file of templateFiles) {
            if (file.endsWith('.hbs')) {
              const templateId = `${category}/${framework}/${file.replace('.hbs', '')}`;
              const filePath = path.join(frameworkPath, file);
              const template = await fs.readFile(filePath, 'utf8');
              
              // Extract metadata from template
              const metadata = this.extractTemplateMetadata(template);
              
              const templateFile: TemplateFile = {
                id: templateId,
                name: metadata.name || file.replace('.hbs', ''),
                path: filePath,
                template,
                framework: framework as SupportedFramework,
                language: metadata.language || 'typescript',
                category: category as TemplateFile['category']
              };
              
              this.loadedTemplates.set(templateId, templateFile);
            }
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to load templates from ${categoryPath}:`, error);
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
        throw new Error(`Template not found: ${templateId}`);
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
      logger.error(`Failed to generate file from template ${templateId}:`, error);
      throw error;
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
        logger.error(`Failed to generate file from selection:`, selection, error);
        throw error;
      }
    }

    return generatedFiles;
  }

  getTemplatesByFramework(framework: SupportedFramework): TemplateFile[] {
    return Array.from(this.loadedTemplates.values()).filter(
      template => template.framework === framework || template.framework === 'common'
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