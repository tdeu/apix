// src/cli/mainnet-guard.ts
import inquirer from 'inquirer';

export const MAINNET_PROMPT = 'This will spend real HBAR on MAINNET. Continue?';

export interface MainnetGuardOptions {
  /** --yes: the user already confirmed */
  yes?: boolean;
  /** Whether a terminal is attached to ask on (defaults to stdin) */
  interactive?: boolean;
  /** Asks the question; defaults to an inquirer confirm (default: No) */
  ask?: (message: string) => Promise<boolean>;
}

async function askWithInquirer(message: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([{ type: 'confirm', name: 'confirmed', message, default: false }]);
  return confirmed === true;
}

/**
 * Call before any command submits a transaction. On mainnet, it asks
 * "This will spend real HBAR on MAINNET. Continue? (y/N)" unless --yes was
 * given. It throws when the user declines, or when there is no terminal to
 * ask on and no --yes. Other networks pass through without a prompt.
 */
export async function confirmMainnetSpend(network: string, options: MainnetGuardOptions = {}): Promise<void> {
  if (network !== 'mainnet' || options.yes) return;

  const interactive = options.interactive ?? process.stdin.isTTY === true;
  if (!interactive) {
    throw new Error('HEDERA_NETWORK is mainnet and this command spends real HBAR. There is no terminal to confirm on: re-run with --yes to proceed.');
  }

  const confirmed = await (options.ask ?? askWithInquirer)(MAINNET_PROMPT);
  if (!confirmed) {
    throw new Error('Cancelled: nothing was sent to mainnet.');
  }
}
