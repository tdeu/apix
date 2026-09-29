import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { logger } from './logger';
import { HEDERA_SDK_VERSION_RANGE } from '../generation/dependency-versions';

const OUTPUT_TAIL_LINES = 30;

function tailLines(text: string, count: number): string {
  return text.split(/\r?\n/).slice(-count).join('\n');
}

/** A package-manager command that exited non-zero, with what it printed */
export class CommandError extends Error {
  constructor(
    readonly command: string,
    readonly cwd: string,
    readonly exitCode: number | null,
    readonly output: string
  ) {
    super(`Command failed (exit ${exitCode ?? 'unknown'}): ${command}`);
  }
}

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



  async installDependencies(): Promise<void> {
    try {
      logger.debug(`Installing dependencies with ${this.manager}...`);

      const command = this.getInstallCommand();
      await this.runCommand(command);

      logger.debug('Dependencies installed successfully');
    } catch (error) {
      const command = this.getInstallCommand().join(' ');
      let enhancedError = `Dependency installation failed with ${this.manager}\n\n`;
      enhancedError += `Command: ${command} (in ${this.projectPath})\n`;
      if (error instanceof CommandError) {
        enhancedError += `Exit code: ${error.exitCode ?? 'unknown'}\n`;
        enhancedError += error.output
          ? `${this.manager} output (last ${OUTPUT_TAIL_LINES} lines):\n${tailLines(error.output, OUTPUT_TAIL_LINES)}\n`
          : `${this.manager} printed nothing.\n`;
      } else {
        enhancedError += `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
      }
      enhancedError += `\nRun \`${command}\` yourself to see the full output.`;
      throw new Error(enhancedError);
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
    const cmd = Array.isArray(command) ? command.join(' ') : command;
    try {
      const output = execSync(cmd, {
        cwd: this.projectPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      return output.trim();
    } catch (error: any) {
      // Keep what the command printed: it is the only real explanation
      const output = `${error.stderr ?? ''}`.trim() || `${error.stdout ?? ''}`.trim();
      logger.debug(`Command failed: ${cmd}`, error.message);
      throw new CommandError(cmd, this.projectPath, error.status ?? null, output);
    }
  }






}