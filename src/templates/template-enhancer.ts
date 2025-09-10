import { ProjectContext } from '../types';
import { logger } from '../utils/logger';

export interface TemplateContext {
  // Project information
  framework: string;
  language: string;
  packageManager: string;
  hasTypeScript: boolean;
  hasNextJs: boolean;
  hasReact: boolean;
  hasVite: boolean;
  
  // Directory structure
  srcDir: string;
  componentsDir: string;
  libDir: string;
  typesDir: string;
  hooksDir: string;
  contextsDir: string;
  apiDir: string;
  
  // Import paths
  importPrefix: string;
  relativeImports: boolean;
  
  // Code style preferences
  usesSemicolons: boolean;
  quotesStyle: 'single' | 'double';
  indentation: string;
  
  // Framework-specific
  nextJsVersion: number;
  reactVersion: number;
  usesAppRouter: boolean;
  usesPagesRouter: boolean;
  
  // Integration options
  options: any;
  
  // Hedera-specific
  hederaNetwork: 'testnet' | 'mainnet';
  hasExistingHTS: boolean;
  hasExistingWallet: boolean;
}

export class TemplateEnhancer {
  
  /**
   * Create enhanced template context from project context
   */
  static createEnhancedContext(
    projectContext: ProjectContext, 
    options: any = {}
  ): TemplateContext {
    const context: TemplateContext = {
      // Basic project info
      framework: projectContext.framework,
      language: projectContext.language,
      packageManager: projectContext.packageManager,
      hasTypeScript: projectContext.language === 'typescript',
      hasNextJs: projectContext.framework === 'next.js',
      hasReact: projectContext.framework.includes('react') || projectContext.framework === 'next.js',
      hasVite: false, // Vite detection would need additional logic
      
      // Directory structure detection
      srcDir: this.detectSrcDir(projectContext),
      componentsDir: this.detectComponentsDir(projectContext),
      libDir: this.detectLibDir(projectContext),
      typesDir: this.detectTypesDir(projectContext),
      hooksDir: this.detectHooksDir(projectContext),
      contextsDir: this.detectContextsDir(projectContext),
      apiDir: this.detectApiDir(projectContext),
      
      // Import configuration
      importPrefix: this.detectImportPrefix(projectContext),
      relativeImports: this.shouldUseRelativeImports(projectContext),
      
      // Code style detection
      usesSemicolons: this.detectSemicolonUsage(projectContext),
      quotesStyle: this.detectQuoteStyle(projectContext),
      indentation: this.detectIndentation(projectContext),
      
      // Framework versions
      nextJsVersion: this.detectNextJsVersion(projectContext),
      reactVersion: this.detectReactVersion(projectContext),
      usesAppRouter: this.detectAppRouter(projectContext),
      usesPagesRouter: this.detectPagesRouter(projectContext),
      
      // Integration options
      options,
      
      // Hedera configuration
      hederaNetwork: options.network || 'testnet',
      hasExistingHTS: this.detectExistingHTS(projectContext),
      hasExistingWallet: this.detectExistingWallet(projectContext)
    };

    logger.debug('Enhanced template context:', context);
    return context;
  }

  /**
   * Detect source directory structure
   */
  private static detectSrcDir(context: ProjectContext): string {
    // Since we don't have access to files list, make educated guess based on framework
    // Next.js projects often use src/ directory, React projects may or may not
    if (context.framework === 'next.js' || context.framework === 'react') {
      return 'src'; // Default assumption for React-based projects
    }
    return '';
  }

  private static detectComponentsDir(context: ProjectContext): string {
    const srcDir = this.detectSrcDir(context);
    const base = srcDir ? `${srcDir}/` : '';
    
    // Default to standard components directory
    return `${base}components`;
  }

  private static detectLibDir(context: ProjectContext): string {
    const srcDir = this.detectSrcDir(context);
    const base = srcDir ? `${srcDir}/` : '';
    
    // Default to standard lib directory
    return `${base}lib`;
  }

  private static detectTypesDir(context: ProjectContext): string {
    const srcDir = this.detectSrcDir(context);
    const base = srcDir ? `${srcDir}/` : '';
    
    if (context.language !== 'typescript') {
      return '';
    }

    // Default to standard types directory for TypeScript
    return `${base}types`;
  }

  private static detectHooksDir(context: ProjectContext): string {
    const srcDir = this.detectSrcDir(context);
    const base = srcDir ? `${srcDir}/` : '';
    
    // Default to standard hooks directory
    return `${base}hooks`;
  }

  private static detectContextsDir(context: ProjectContext): string {
    const srcDir = this.detectSrcDir(context);
    const base = srcDir ? `${srcDir}/` : '';
    
    // Default to standard contexts directory
    return `${base}contexts`;
  }

  private static detectApiDir(context: ProjectContext): string {
    if (context.framework !== 'next.js') {
      return '';
    }

    // Default to App Router structure for modern Next.js projects
    const srcDir = this.detectSrcDir(context);
    return srcDir ? 'src/app/api' : 'app/api';
  }

  private static detectImportPrefix(context: ProjectContext): string {
    // Default to @ prefix for modern React projects
    return '@';
  }

  private static shouldUseRelativeImports(context: ProjectContext): boolean {
    // Analyze existing import patterns in the project
    // For now, default to absolute imports with @ prefix
    return false;
  }

  private static detectSemicolonUsage(context: ProjectContext): boolean {
    // Analyze existing code style
    // Default to using semicolons for TypeScript, optional for JavaScript
    return context.language === 'typescript';
  }

  private static detectQuoteStyle(context: ProjectContext): 'single' | 'double' {
    // Analyze existing code style
    // Default to single quotes (more common in modern React)
    return 'single';
  }

  private static detectIndentation(context: ProjectContext): string {
    // Analyze existing code style
    // Default to 2 spaces
    return '  ';
  }

  private static detectNextJsVersion(context: ProjectContext): number {
    if (context.framework !== 'next.js') return 0;
    
    const nextDep = context.dependencies.find(dep => dep.name === 'next');
    if (nextDep) {
      const version = nextDep.version.replace(/[^\d.]/g, '');
      const major = parseInt(version.split('.')[0]);
      return major || 13; // Default to 13 if can't parse
    }
    
    return 13; // Default to Next.js 13
  }

  private static detectReactVersion(context: ProjectContext): number {
    const reactDep = context.dependencies.find(dep => dep.name === 'react');
    if (reactDep) {
      const version = reactDep.version.replace(/[^\d.]/g, '');
      const major = parseInt(version.split('.')[0]);
      return major || 18; // Default to 18 if can't parse
    }
    
    return 18; // Default to React 18
  }

  private static detectAppRouter(context: ProjectContext): boolean {
    if (context.framework !== 'next.js') return false;
    
    // Default to App Router for modern Next.js projects
    return true; // Assume App Router is used (Next.js 13+)
  }

  private static detectPagesRouter(context: ProjectContext): boolean {
    if (context.framework !== 'next.js') return false;
    
    // Inverse of App Router detection
    return !this.detectAppRouter(context);
  }

  private static detectExistingHTS(context: ProjectContext): boolean {
    // Check dependencies for existing Hedera SDK
    return context.dependencies.some(dep => dep.name === '@hashgraph/sdk');
  }

  private static detectExistingWallet(context: ProjectContext): boolean {
    // Check dependencies for wallet-related packages
    return context.dependencies.some(dep => 
      dep.name.includes('wallet') || 
      dep.name.includes('hashpack') || 
      dep.name.includes('blade')
    );
  }

  /**
   * Get appropriate file extension based on language and context
   */
  static getFileExtension(context: TemplateContext, isReactComponent: boolean = false): string {
    if (context.hasTypeScript) {
      return isReactComponent ? '.tsx' : '.ts';
    }
    return isReactComponent ? '.jsx' : '.js';
  }

  /**
   * Generate import statement with correct path and style
   */
  static generateImport(
    context: TemplateContext,
    imports: string[],
    from: string,
    isDefault: boolean = false
  ): string {
    const quote = context.quotesStyle === 'single' ? "'" : '"';
    const semi = context.usesSemicolons ? ';' : '';
    
    if (isDefault) {
      return `import ${imports[0]} from ${quote}${from}${quote}${semi}`;
    }
    
    if (imports.length === 1) {
      return `import { ${imports[0]} } from ${quote}${from}${quote}${semi}`;
    }
    
    // Multi-line import for readability
    const importList = imports.map(imp => `${context.indentation}${imp}`).join(',\n');
    return `import {\n${importList}\n} from ${quote}${from}${quote}${semi}`;
  }

  /**
   * Resolve path based on project structure and import preferences
   */
  static resolvePath(
    context: TemplateContext, 
    path: string,
    currentDir: string = ''
  ): string {
    // Handle absolute imports with @/ prefix
    if (!context.relativeImports && context.importPrefix) {
      const srcBase = context.srcDir || '';
      if (path.startsWith('components/')) {
        return `${context.importPrefix}/${context.componentsDir.replace(srcBase + '/', '')}/${path.replace('components/', '')}`;
      }
      if (path.startsWith('lib/')) {
        return `${context.importPrefix}/${context.libDir.replace(srcBase + '/', '')}/${path.replace('lib/', '')}`;
      }
      if (path.startsWith('hooks/')) {
        return `${context.importPrefix}/${context.hooksDir.replace(srcBase + '/', '')}/${path.replace('hooks/', '')}`;
      }
      if (path.startsWith('contexts/')) {
        return `${context.importPrefix}/${context.contextsDir.replace(srcBase + '/', '')}/${path.replace('contexts/', '')}`;
      }
      if (path.startsWith('types/')) {
        return `${context.importPrefix}/${context.typesDir.replace(srcBase + '/', '')}/${path.replace('types/', '')}`;
      }
    }
    
    // Default to the path as-is for relative imports or fallback
    return path;
  }

  /**
   * Generate conditional code based on context
   */
  static conditionalCode(
    context: TemplateContext,
    conditions: { [key: string]: string }
  ): string {
    for (const [condition, code] of Object.entries(conditions)) {
      if (this.evaluateCondition(context, condition)) {
        return code;
      }
    }
    return conditions.default || '';
  }

  private static evaluateCondition(context: TemplateContext, condition: string): boolean {
    switch (condition) {
      case 'typescript': return context.hasTypeScript;
      case 'javascript': return !context.hasTypeScript;
      case 'nextjs': return context.hasNextJs;
      case 'react': return context.hasReact;
      case 'vite': return context.hasVite;
      case 'app-router': return context.usesAppRouter;
      case 'pages-router': return context.usesPagesRouter;
      case 'has-hts': return context.hasExistingHTS;
      case 'has-wallet': return context.hasExistingWallet;
      default: return false;
    }
  }

  /**
   * Format code according to project style
   */
  static formatCode(context: TemplateContext, code: string): string {
    let formatted = code;
    
    // Handle semicolons
    if (!context.usesSemicolons) {
      formatted = formatted.replace(/;$/gm, '');
    }
    
    // Handle quotes (basic replacement)
    if (context.quotesStyle === 'single') {
      formatted = formatted.replace(/"/g, "'");
    } else {
      formatted = formatted.replace(/'/g, '"');
    }
    
    return formatted;
  }

  /**
   * Generate component export statement
   */
  static generateExport(
    context: TemplateContext,
    componentName: string,
    isDefault: boolean = true
  ): string {
    const semi = context.usesSemicolons ? ';' : '';
    
    if (isDefault) {
      return `export default ${componentName}${semi}`;
    } else {
      return `export { ${componentName} }${semi}`;
    }
  }
}

// Helper functions for Handlebars templates
export const TemplateHelpers = {
  // Enhanced ifLanguage helper
  ifLanguage: (context: TemplateContext, language: string, options: any) => {
    if (context.language === language) {
      return options.fn(context);
    } else {
      return options.inverse ? options.inverse(context) : '';
    }
  },

  // Framework detection helper
  ifFramework: (context: TemplateContext, framework: string, options: any) => {
    if (context.framework === framework || 
        (framework === 'react' && context.hasReact)) {
      return options.fn(context);
    } else {
      return options.inverse ? options.inverse(context) : '';
    }
  },

  // Import path resolver
  importPath: (context: TemplateContext, path: string) => {
    return TemplateEnhancer.resolvePath(context, path);
  },

  // File extension resolver
  fileExt: (context: TemplateContext, isComponent: boolean = false) => {
    return TemplateEnhancer.getFileExtension(context, isComponent);
  },

  // Code formatting
  formatCode: (context: TemplateContext, code: string) => {
    return TemplateEnhancer.formatCode(context, code);
  },

  // Conditional code generation
  conditional: (context: TemplateContext, condition: string, options: any) => {
    if (TemplateEnhancer['evaluateCondition'](context, condition)) {
      return options.fn(context);
    } else {
      return options.inverse ? options.inverse(context) : '';
    }
  }
};