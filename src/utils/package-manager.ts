import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { logger } from './logger';

export interface Dependency {
  name: string;
  version: string;
  type: 'dependencies' | 'devDependencies';
}

export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class PackageManager {
  private projectPath: string;
  private packageJsonPath: string;
  private manager: 'npm' | 'yarn' | 'pnpm';

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    this.packageJsonPath = path.join(projectPath, 'package.json');
    this.manager = this.detectPackageManager();
  }

  private detectPackageManager(): 'npm' | 'yarn' | 'pnpm' {
    // Check for lock files to determine package manager
    if (fs.existsSync(path.join(this.projectPath, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (fs.existsSync(path.join(this.projectPath, 'yarn.lock'))) {
      return 'yarn';
    }
    return 'npm';
  }

  async getPackageInfo(): Promise<PackageInfo> {
    try {
      if (!await fs.pathExists(this.packageJsonPath)) {
        throw new Error('package.json not found');
      }

      const packageJson = await fs.readJSON(this.packageJsonPath);
      return packageJson;
    } catch (error) {
      logger.error('Failed to read package.json:', error);
      throw error;
    }
  }

  async updatePackageJson(updates: Partial<PackageInfo>): Promise<void> {
    try {
      const currentPackage = await this.getPackageInfo();
      const updatedPackage = { ...currentPackage, ...updates };

      // Merge dependencies and devDependencies properly
      if (updates.dependencies) {
        updatedPackage.dependencies = {
          ...currentPackage.dependencies,
          ...updates.dependencies
        };
      }

      if (updates.devDependencies) {
        updatedPackage.devDependencies = {
          ...currentPackage.devDependencies,
          ...updates.devDependencies
        };
      }

      await fs.writeJSON(this.packageJsonPath, updatedPackage, { spaces: 2 });
      logger.debug('Updated package.json');
    } catch (error) {
      logger.error('Failed to update package.json:', error);
      throw error;
    }
  }

  async addDependencies(dependencies: Dependency[]): Promise<void> {
    try {
      // Update package.json first
      const packageInfo = await this.getPackageInfo();
      
      for (const dep of dependencies) {
        if (dep.type === 'dependencies') {
          packageInfo.dependencies = packageInfo.dependencies || {};
          packageInfo.dependencies[dep.name] = dep.version;
        } else {
          packageInfo.devDependencies = packageInfo.devDependencies || {};
          packageInfo.devDependencies[dep.name] = dep.version;
        }
      }

      await fs.writeJSON(this.packageJsonPath, packageInfo, { spaces: 2 });
      
      // Install dependencies
      await this.installDependencies();
      
      logger.debug(`Added ${dependencies.length} dependencies`);
    } catch (error) {
      logger.error('Failed to add dependencies:', error);
      throw error;
    }
  }

  async addDependency(name: string, version: string = 'latest', isDev: boolean = false): Promise<void> {
    const dependency: Dependency = {
      name,
      version,
      type: isDev ? 'devDependencies' : 'dependencies'
    };

    await this.addDependencies([dependency]);
  }

  async removeDependency(name: string): Promise<void> {
    try {
      const packageInfo = await this.getPackageInfo();
      
      // Remove from both dependencies and devDependencies
      if (packageInfo.dependencies && packageInfo.dependencies[name]) {
        delete packageInfo.dependencies[name];
      }
      
      if (packageInfo.devDependencies && packageInfo.devDependencies[name]) {
        delete packageInfo.devDependencies[name];
      }

      await fs.writeJSON(this.packageJsonPath, packageInfo, { spaces: 2 });
      
      // Uninstall the dependency
      await this.runPackageCommand(['remove', name]);
      
      logger.debug(`Removed dependency: ${name}`);
    } catch (error) {
      logger.error(`Failed to remove dependency ${name}:`, error);
      throw error;
    }
  }

  async installDependencies(): Promise<void> {
    try {
      logger.debug(`Installing dependencies with ${this.manager}...`);
      
      const command = this.getInstallCommand();
      await this.runCommand(command);
      
      logger.debug('Dependencies installed successfully');
    } catch (error) {
      logger.error('Failed to install dependencies:', error);
      throw error;
    }
  }

  async addScript(name: string, command: string): Promise<void> {
    try {
      const packageInfo = await this.getPackageInfo();
      packageInfo.scripts = packageInfo.scripts || {};
      packageInfo.scripts[name] = command;

      await fs.writeJSON(this.packageJsonPath, packageInfo, { spaces: 2 });
      logger.debug(`Added script: ${name}`);
    } catch (error) {
      logger.error(`Failed to add script ${name}:`, error);
      throw error;
    }
  }

  async removeScript(name: string): Promise<void> {
    try {
      const packageInfo = await this.getPackageInfo();
      
      if (packageInfo.scripts && packageInfo.scripts[name]) {
        delete packageInfo.scripts[name];
        await fs.writeJSON(this.packageJsonPath, packageInfo, { spaces: 2 });
        logger.debug(`Removed script: ${name}`);
      }
    } catch (error) {
      logger.error(`Failed to remove script ${name}:`, error);
      throw error;
    }
  }

  async runScript(name: string): Promise<string> {
    try {
      const command = `${this.manager} run ${name}`;
      const output = await this.runCommand(command);
      return output;
    } catch (error) {
      logger.error(`Failed to run script ${name}:`, error);
      throw error;
    }
  }

  async checkDependency(name: string): Promise<{ installed: boolean; version?: string; isDev?: boolean }> {
    try {
      const packageInfo = await this.getPackageInfo();
      
      if (packageInfo.dependencies && packageInfo.dependencies[name]) {
        return {
          installed: true,
          version: packageInfo.dependencies[name],
          isDev: false
        };
      }
      
      if (packageInfo.devDependencies && packageInfo.devDependencies[name]) {
        return {
          installed: true,
          version: packageInfo.devDependencies[name],
          isDev: true
        };
      }
      
      return { installed: false };
    } catch (error) {
      logger.error(`Failed to check dependency ${name}:`, error);
      return { installed: false };
    }
  }

  async getOutdatedDependencies(): Promise<Record<string, { current: string; wanted: string; latest: string }>> {
    try {
      let command: string;
      
      switch (this.manager) {
        case 'npm':
          command = 'npm outdated --json';
          break;
        case 'yarn':
          command = 'yarn outdated --json';
          break;
        case 'pnpm':
          command = 'pnpm outdated --format json';
          break;
      }
      
      const output = await this.runCommand(command);
      return JSON.parse(output);
    } catch (error) {
      logger.warn('Failed to check outdated dependencies:', error);
      return {};
    }
  }

  private getInstallCommand(): string[] {
    switch (this.manager) {
      case 'yarn':
        return ['yarn', 'install'];
      case 'pnpm':
        return ['pnpm', 'install'];
      default:
        return ['npm', 'install'];
    }
  }

  private async runPackageCommand(args: string[]): Promise<string> {
    const command = [this.manager, ...args];
    return this.runCommand(command);
  }

  private async runCommand(command: string | string[]): Promise<string> {
    try {
      const cmd = Array.isArray(command) ? command.join(' ') : command;
      
      const output = execSync(cmd, {
        cwd: this.projectPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      return output.trim();
    } catch (error: any) {
      logger.error(`Command failed: ${command}`, error.message);
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  getManager(): string {
    return this.manager;
  }

  // Hedera-specific dependencies
  async addHederaDependencies(): Promise<void> {
    const hederaDeps: Dependency[] = [
      { name: '@hashgraph/sdk', version: '^2.68.0', type: 'dependencies' },
      { name: '@hashgraph/hedera-wallet-connect', version: 'latest', type: 'dependencies' }
    ];

    await this.addDependencies(hederaDeps);
  }

  async addReactDependencies(): Promise<void> {
    const reactDeps: Dependency[] = [
      { name: 'react', version: '^18.0.0', type: 'dependencies' },
      { name: 'react-dom', version: '^18.0.0', type: 'dependencies' },
      { name: '@types/react', version: '^18.0.0', type: 'devDependencies' },
      { name: '@types/react-dom', version: '^18.0.0', type: 'devDependencies' }
    ];

    await this.addDependencies(reactDeps);
  }

  async addNextJSDependencies(): Promise<void> {
    const nextDeps: Dependency[] = [
      { name: 'next', version: '^14.0.0', type: 'dependencies' },
      { name: 'react', version: '^18.0.0', type: 'dependencies' },
      { name: 'react-dom', version: '^18.0.0', type: 'dependencies' },
      { name: '@types/node', version: '^20.0.0', type: 'devDependencies' },
      { name: '@types/react', version: '^18.0.0', type: 'devDependencies' },
      { name: '@types/react-dom', version: '^18.0.0', type: 'devDependencies' },
      { name: 'typescript', version: '^5.0.0', type: 'devDependencies' }
    ];

    await this.addDependencies(nextDeps);
  }

  // Create a backup of package.json before making changes
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.projectPath, `package.json.backup.${timestamp}`);
    
    await fs.copy(this.packageJsonPath, backupPath);
    logger.debug(`Created package.json backup: ${backupPath}`);
    
    return backupPath;
  }

  async restoreBackup(backupPath: string): Promise<void> {
    if (!await fs.pathExists(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }
    
    await fs.copy(backupPath, this.packageJsonPath);
    logger.debug(`Restored package.json from backup: ${backupPath}`);
  }
}