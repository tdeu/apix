import fs from 'fs-extra';
import path from 'path';
import { GeneratedFile, FileModification } from '@/types';
import { logger } from '@utils/logger';

export interface ConflictResolution {
  action: 'overwrite' | 'merge' | 'skip' | 'backup';
  backupPath?: string;
}

export interface GenerationOptions {
  conflictResolution?: 'ask' | 'overwrite' | 'skip' | 'backup';
  createBackups?: boolean;
  validateFiles?: boolean;
}

export class FileGenerator {
  private projectPath: string;
  private backupCounter: number = 0;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
  }

  async generateFiles(files: GeneratedFile[], options: GenerationOptions = {}): Promise<void> {
    const {
      conflictResolution = 'ask',
      createBackups = true,
      validateFiles = true
    } = options;

    logger.debug(`Generating ${files.length} files...`);

    for (const file of files) {
      try {
        await this.generateFile(file, {
          conflictResolution,
          createBackups,
          validateFiles
        });
      } catch (error) {
        logger.error(`Failed to generate file ${file.path}:`, error);
        throw error;
      }
    }

    logger.debug('File generation complete');
  }

  async generateFile(file: GeneratedFile, options: GenerationOptions = {}): Promise<void> {
    const filePath = path.isAbsolute(file.path) 
      ? file.path 
      : path.join(this.projectPath, file.path);

    // Check if file exists
    const exists = await fs.pathExists(filePath);

    if (exists && !file.overwrite) {
      const resolution = await this.resolveConflict(filePath, file, options);
      await this.applyResolution(filePath, file, resolution);
    } else {
      // Create directory if it doesn't exist
      await fs.ensureDir(path.dirname(filePath));
      
      // Write the file
      await fs.writeFile(filePath, file.content, 'utf8');
      logger.debug(`Generated file: ${filePath}`);
    }

    // Validate generated file if requested
    if (options.validateFiles) {
      await this.validateFile(filePath, file);
    }
  }

  private async resolveConflict(
    filePath: string, 
    file: GeneratedFile, 
    options: GenerationOptions
  ): Promise<ConflictResolution> {
    const { conflictResolution = 'ask' } = options;

    switch (conflictResolution) {
      case 'overwrite':
        return { action: 'overwrite' };
      
      case 'skip':
        return { action: 'skip' };
      
      case 'backup':
        const backupPath = await this.generateBackupPath(filePath);
        return { action: 'backup', backupPath };
      
      case 'ask':
      default:
        return await this.promptUserForResolution(filePath, file);
    }
  }

  private async promptUserForResolution(
    filePath: string, 
    file: GeneratedFile
  ): Promise<ConflictResolution> {
    // For now, default to backup - in a full implementation, you'd use inquirer here
    const backupPath = await this.generateBackupPath(filePath);
    logger.warn(`File exists: ${filePath}. Creating backup: ${backupPath}`);
    return { action: 'backup', backupPath };
  }

  private async applyResolution(
    filePath: string, 
    file: GeneratedFile, 
    resolution: ConflictResolution
  ): Promise<void> {
    switch (resolution.action) {
      case 'skip':
        logger.debug(`Skipped file: ${filePath}`);
        break;

      case 'overwrite':
        await fs.writeFile(filePath, file.content, 'utf8');
        logger.debug(`Overwritten file: ${filePath}`);
        break;

      case 'backup':
        if (resolution.backupPath) {
          // Create backup
          await fs.copy(filePath, resolution.backupPath);
          logger.debug(`Created backup: ${resolution.backupPath}`);
        }
        
        // Write new content
        await fs.writeFile(filePath, file.content, 'utf8');
        logger.debug(`Generated file with backup: ${filePath}`);
        break;

      case 'merge':
        await this.mergeFiles(filePath, file);
        logger.debug(`Merged file: ${filePath}`);
        break;
    }
  }

  private async generateBackupPath(filePath: string): Promise<string> {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const name = path.basename(filePath, ext);
    
    let backupPath: string;
    do {
      this.backupCounter++;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = path.join(dir, `${name}.backup.${timestamp}${ext}`);
    } while (await fs.pathExists(backupPath));

    return backupPath;
  }

  private async mergeFiles(filePath: string, newFile: GeneratedFile): Promise<void> {
    const existingContent = await fs.readFile(filePath, 'utf8');
    
    // Simple merge strategy - append new content after existing
    // In a full implementation, you'd have more sophisticated merging
    const mergedContent = this.performContentMerge(existingContent, newFile.content);
    
    await fs.writeFile(filePath, mergedContent, 'utf8');
  }

  private performContentMerge(existingContent: string, newContent: string): string {
    // This is a basic merge strategy - in practice, you'd want more sophisticated merging
    // based on file type, imports, exports, etc.
    
    if (existingContent.includes('// APIx Generated Code')) {
      // Replace existing APIx generated section
      const startMarker = '// APIx Generated Code - START';
      const endMarker = '// APIx Generated Code - END';
      
      const startIndex = existingContent.indexOf(startMarker);
      const endIndex = existingContent.indexOf(endMarker);
      
      if (startIndex !== -1 && endIndex !== -1) {
        const before = existingContent.substring(0, startIndex);
        const after = existingContent.substring(endIndex + endMarker.length);
        
        return `${before}${startMarker}\n${newContent}\n${endMarker}${after}`;
      }
    }
    
    // Default: append new content with markers
    return `${existingContent}\n\n// APIx Generated Code - START\n${newContent}\n// APIx Generated Code - END\n`;
  }

  async applyModifications(modifications: FileModification[]): Promise<void> {
    for (const mod of modifications) {
      try {
        await this.applyModification(mod);
      } catch (error) {
        logger.error(`Failed to apply modification to ${mod.filePath}:`, error);
        throw error;
      }
    }
  }

  private async applyModification(modification: FileModification): Promise<void> {
    const filePath = path.isAbsolute(modification.filePath)
      ? modification.filePath
      : path.join(this.projectPath, modification.filePath);

    if (!await fs.pathExists(filePath)) {
      throw new Error(`File not found for modification: ${filePath}`);
    }

    const content = await fs.readFile(filePath, 'utf8');
    let modifiedContent: string;

    switch (modification.type) {
      case 'insert':
        modifiedContent = this.insertContent(content, modification);
        break;
      case 'replace':
        modifiedContent = this.replaceContent(content, modification);
        break;
      case 'append':
        modifiedContent = content + '\n' + modification.content;
        break;
      default:
        throw new Error(`Unknown modification type: ${modification.type}`);
    }

    await fs.writeFile(filePath, modifiedContent, 'utf8');
    logger.debug(`Applied ${modification.type} modification to ${filePath}`);
  }

  private insertContent(content: string, modification: FileModification): string {
    const lines = content.split('\n');
    const position = modification.position ?? lines.length;
    
    lines.splice(position, 0, modification.content);
    return lines.join('\n');
  }

  private replaceContent(content: string, modification: FileModification): string {
    if (modification.searchPattern) {
      return content.replace(modification.searchPattern, modification.content);
    }
    
    // If no search pattern, replace entire content
    return modification.content;
  }

  private async validateFile(filePath: string, file: GeneratedFile): Promise<void> {
    try {
      // Basic validation - check if file was written correctly
      const written = await fs.readFile(filePath, 'utf8');
      
      if (written !== file.content) {
        logger.warn(`Content mismatch in generated file: ${filePath}`);
      }

      // Type-specific validation
      if (file.type === 'typescript') {
        await this.validateTypeScriptFile(filePath);
      } else if (file.type === 'json') {
        await this.validateJsonFile(filePath);
      }

    } catch (error) {
      logger.warn(`File validation failed for ${filePath}:`, error);
    }
  }

  private async validateTypeScriptFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Basic syntax checks
      if (content.includes('import') && !content.includes('from')) {
        logger.warn(`Potentially invalid TypeScript syntax in ${filePath}: import without from`);
      }
      
      // Check for unclosed brackets/braces
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      
      if (openBraces !== closeBraces) {
        logger.warn(`Unmatched braces in ${filePath}: ${openBraces} open, ${closeBraces} close`);
      }

    } catch (error) {
      logger.warn(`TypeScript validation error for ${filePath}:`, error);
    }
  }

  private async validateJsonFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      JSON.parse(content); // This will throw if invalid JSON
    } catch (error) {
      logger.warn(`Invalid JSON in ${filePath}:`, error);
      throw new Error(`Generated JSON file is invalid: ${filePath}`);
    }
  }

  async getConflicts(files: GeneratedFile[]): Promise<string[]> {
    const conflicts: string[] = [];

    for (const file of files) {
      const filePath = path.isAbsolute(file.path)
        ? file.path
        : path.join(this.projectPath, file.path);

      if (await fs.pathExists(filePath) && !file.overwrite) {
        conflicts.push(filePath);
      }
    }

    return conflicts;
  }

  async cleanupBackups(olderThanDays: number = 7): Promise<void> {
    try {
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      
      const findBackups = async (dir: string): Promise<string[]> => {
        const backups: string[] = [];
        
        try {
          const items = await fs.readdir(dir);
          
          for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = await fs.stat(itemPath);
            
            if (stat.isDirectory()) {
              const nestedBackups = await findBackups(itemPath);
              backups.push(...nestedBackups);
            } else if (item.includes('.backup.') && stat.mtime.getTime() < cutoffTime) {
              backups.push(itemPath);
            }
          }
        } catch (error) {
          // Ignore directories we can't read
        }
        
        return backups;
      };

      const backups = await findBackups(this.projectPath);
      
      for (const backup of backups) {
        await fs.remove(backup);
        logger.debug(`Removed old backup: ${backup}`);
      }

      if (backups.length > 0) {
        logger.debug(`Cleaned up ${backups.length} old backup files`);
      }

    } catch (error) {
      logger.warn('Failed to cleanup backups:', error);
    }
  }
}