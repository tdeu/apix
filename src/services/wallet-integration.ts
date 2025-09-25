/**
 * Hedera Wallet Integration Service
 *
 * Provides integration with popular Hedera wallets including HashPack, Blade, and WalletConnect
 * Supports wallet connection, account management, and transaction signing
 */

import { logger } from '../utils/logger';
import { SignClient } from '@walletconnect/sign-client';
import QRCodeModal from '@walletconnect/qrcode-modal';
import { getSdkError } from '@walletconnect/utils';

// Browser globals declaration
declare const window: any & {
  hashpack?: {
    connect(): Promise<{ success: boolean; accounts?: any[]; error?: string }>;
    disconnect(): Promise<void>;
    signTransaction(data: any): Promise<{ success: boolean; transactionId?: string; receipt?: any; error?: string }>;
  };
  blade?: {
    createAccount(network: string): Promise<{ success: boolean; accountId?: string; evmAddress?: string; publicKey?: string; error?: string }>;
    disconnect(): Promise<void>;
    transferHbars(from: string, to: string, amount: number, memo: string): Promise<{ success: boolean; transactionId?: string; receipt?: any; error?: string }>;
    createToken(name: string, symbol: string, decimals: number, supply: number, accountId: string): Promise<{ success: boolean; transactionId?: string; receipt?: any; error?: string }>;
    contractCallFunction(contractId: string, functionName: string, params: any, accountId: string, gas: number): Promise<{ success: boolean; transactionId?: string; receipt?: any; error?: string }>;
  };
  ethereum?: {
    request(args: { method: string; params?: any[] }): Promise<any>;
    isMetaMask?: boolean;
  };
};

export interface WalletInfo {
  id: string;
  name: string;
  description: string;
  icon?: string;
  downloadUrl?: string;
  isInstalled: boolean;
  isAvailable: boolean;
}

export interface WalletAccount {
  accountId: string;
  evmAddress?: string;
  publicKey?: string;
  walletId: string;
}

export interface WalletConnectionResult {
  success: boolean;
  wallet?: WalletInfo;
  accounts?: WalletAccount[];
  error?: string;
}

export interface TransactionRequest {
  type: 'transfer' | 'contract-call' | 'token-create' | 'topic-create' | 'hts-create' | 'hts-transfer' | 'hbar-transfer' | 'smart-contract-call';
  data: any;
  network: 'testnet' | 'mainnet';
  accountId?: string;
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  receipt?: any;
  error?: string;
  explorerUrl?: string;
}

export class WalletIntegrationService {
  private connectedWallet: WalletInfo | null = null;
  private connectedAccounts: WalletAccount[] = [];
  private network: 'testnet' | 'mainnet';
  private walletConnectClient: InstanceType<typeof SignClient> | null = null;
  private walletConnectSession: any = null;
  private projectId: string = 'your-project-id-here'; // Should be configured via environment

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    this.network = network;
    this.projectId = process.env.WALLETCONNECT_PROJECT_ID || 'apix-hedera-default';
  }

  /**
   * Get list of supported wallets and their availability
   */
  async getSupportedWallets(): Promise<WalletInfo[]> {
    const wallets: WalletInfo[] = [
      {
        id: 'hashpack',
        name: 'HashPack',
        description: 'The most popular Hedera wallet with full DApp support',
        icon: 'https://hashpack.app/img/logo.svg',
        downloadUrl: 'https://chrome.google.com/webstore/detail/hashpack/gjagmgiddbbciopjhllkdnddhcglnemk',
        isInstalled: await this.isHashPackInstalled(),
        isAvailable: true
      },
      {
        id: 'blade',
        name: 'Blade Wallet',
        description: 'Multi-chain wallet with Hedera support',
        icon: 'https://bladewallet.io/img/logo.png',
        downloadUrl: 'https://chrome.google.com/webstore/detail/blade-wallet/abogmiocnneedmmepnohnhlijcjpcifd',
        isInstalled: await this.isBladeInstalled(),
        isAvailable: true
      },
      {
        id: 'walletconnect',
        name: 'WalletConnect',
        description: 'Connect with any WalletConnect-compatible wallet',
        isInstalled: true, // Always available as protocol
        isAvailable: true
      },
      {
        id: 'metamask-snap',
        name: 'MetaMask Hedera Snap',
        description: 'Use MetaMask with Hedera through a Snap extension',
        downloadUrl: 'https://snaps.metamask.io/snap/npm/hashgraph/hedera-wallet-snap/',
        isInstalled: await this.isMetaMaskSnapAvailable(),
        isAvailable: true // Now fully implemented
      }
    ];

    logger.info('Wallet availability checked', {
      wallets: wallets.map(w => ({
        name: w.name,
        installed: w.isInstalled,
        available: w.isAvailable
      }))
    });

    return wallets;
  }

  /**
   * Connect to a specific wallet
   */
  async connectWallet(walletId: string): Promise<WalletConnectionResult> {
    try {
      logger.info('Attempting to connect wallet:', { walletId, network: this.network });

      switch (walletId) {
        case 'hashpack':
          return await this.connectHashPack();
        case 'blade':
          return await this.connectBlade();
        case 'walletconnect':
          return await this.connectWalletConnect();
        case 'metamask-snap':
          return await this.connectMetaMaskSnap();
        default:
          return {
            success: false,
            error: `Unsupported wallet: ${walletId}`
          };
      }
    } catch (error: any) {
      logger.error('Wallet connection failed:', error);
      return {
        success: false,
        error: `Wallet connection failed: ${error.message}`
      };
    }
  }

  /**
   * Disconnect current wallet
   */
  async disconnectWallet(): Promise<void> {
    if (this.connectedWallet) {
      logger.info('Disconnecting wallet:', { walletId: this.connectedWallet.id });

      try {
        // Wallet-specific disconnection logic
        switch (this.connectedWallet.id) {
          case 'hashpack':
            await this.disconnectHashPack();
            break;
          case 'blade':
            await this.disconnectBlade();
            break;
          case 'walletconnect':
            await this.disconnectWalletConnect();
            break;
          case 'metamask-snap':
            await this.disconnectMetaMaskSnap();
            break;
        }
      } catch (error: any) {
        logger.error('Error during wallet disconnection:', error);
      }

      this.connectedWallet = null;
      this.connectedAccounts = [];
    }
  }

  /**
   * Get connected wallet info
   */
  getConnectedWallet(): WalletInfo | null {
    return this.connectedWallet;
  }

  /**
   * Get connected accounts
   */
  getConnectedAccounts(): WalletAccount[] {
    return this.connectedAccounts;
  }

  /**
   * Sign and submit transaction through connected wallet
   */
  async signTransaction(request: TransactionRequest): Promise<TransactionResult> {
    if (!this.connectedWallet) {
      return {
        success: false,
        error: 'No wallet connected'
      };
    }

    try {
      logger.info('Signing transaction with wallet:', {
        walletId: this.connectedWallet.id,
        transactionType: request.type,
        network: request.network
      });

      switch (this.connectedWallet.id) {
        case 'hashpack':
          return await this.signWithHashPack(request);
        case 'blade':
          return await this.signWithBlade(request);
        case 'walletconnect':
          return await this.signWithWalletConnect(request);
        case 'metamask-snap':
          return await this.signWithMetaMaskSnap(request);
        default:
          return {
            success: false,
            error: `Transaction signing not supported for wallet: ${this.connectedWallet.id}`
          };
      }
    } catch (error: any) {
      logger.error('Transaction signing failed:', error);
      return {
        success: false,
        error: `Transaction signing failed: ${error.message}`
      };
    }
  }

  // ========================================
  // HashPack Integration
  // ========================================

  private async isHashPackInstalled(): Promise<boolean> {
    try {
      // Check if window.hashpack exists (browser environment)
      if (typeof window !== 'undefined' && typeof (window as any) !== 'undefined') {
        return !!(window as any).hashpack;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async connectHashPack(): Promise<WalletConnectionResult> {
    try {
      logger.info('Attempting HashPack wallet connection');

      // Check if HashPack is installed
      if (!window.hashpack) {
        logger.warn('HashPack extension not found');
        return {
          success: false,
          error: 'HashPack extension not installed. Please install from Chrome Web Store.'
        };
      }

      // Initialize HashPack connection
      const hashconnect = window.hashpack;

      // Request connection
      const connectionResult = await hashconnect.connect();

      if (!connectionResult.success) {
        logger.error('HashPack connection failed:', connectionResult.error);
        return {
          success: false,
          error: connectionResult.error || 'Failed to connect to HashPack'
        };
      }

      // Get account information
      const accounts = connectionResult.accounts || [];
      const walletAccounts: WalletAccount[] = accounts.map((account: any) => ({
        accountId: account.accountId || account.id,
        evmAddress: account.evmAddress,
        publicKey: account.publicKey,
        walletId: 'hashpack'
      }));

      logger.info('HashPack connected successfully', {
        accountCount: walletAccounts.length,
        network: this.network
      });

      return {
        success: true,
        wallet: {
          id: 'hashpack',
          name: 'HashPack',
          description: 'Connected to HashPack wallet',
          isInstalled: true,
          isAvailable: true
        },
        accounts: walletAccounts
      };

    } catch (error: any) {
      logger.error('HashPack connection error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error connecting to HashPack'
      };
    }
  }

  private async disconnectHashPack(): Promise<void> {
    try {
      logger.info('Disconnecting from HashPack wallet');

      if (window.hashpack && window.hashpack.disconnect) {
        await window.hashpack.disconnect();
        logger.info('HashPack disconnected successfully');
      } else {
        logger.warn('HashPack disconnect method not available');
      }

      // Clear connection state
      this.connectedWallet = null;
      this.connectedAccounts = [];

    } catch (error: any) {
      logger.error('HashPack disconnection error:', error);
      // Continue anyway to clear local state
      this.connectedWallet = null;
      this.connectedAccounts = [];
    }
  }

  private async signWithHashPack(request: TransactionRequest): Promise<TransactionResult> {
    try {
      logger.info('Signing transaction with HashPack', { type: request.type, network: request.network });

      if (!window.hashpack) {
        return {
          success: false,
          error: 'HashPack extension not available'
        };
      }

      if (!this.connectedAccounts.length) {
        return {
          success: false,
          error: 'No HashPack accounts connected'
        };
      }

      // Prepare transaction data for HashPack
      const transactionData = {
        type: request.type,
        data: request.data,
        network: request.network,
        accountId: this.connectedAccounts[0].accountId
      };

      // Sign transaction using HashPack
      const signResult = await window.hashpack.signTransaction(transactionData);

      if (!signResult.success) {
        logger.error('HashPack transaction signing failed:', signResult.error);
        return {
          success: false,
          error: signResult.error || 'Transaction signing failed'
        };
      }

      logger.info('HashPack transaction signed successfully', {
        transactionId: signResult.transactionId,
        type: request.type
      });

      return {
        success: true,
        transactionId: signResult.transactionId,
        receipt: signResult.receipt
      };

    } catch (error: any) {
      logger.error('HashPack transaction signing error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error signing transaction'
      };
    }
  }

  // ========================================
  // Blade Wallet Integration
  // ========================================

  private async isBladeInstalled(): Promise<boolean> {
    try {
      // Check if Blade wallet is available
      if (typeof window !== 'undefined') {
        return !!(window as any).blade;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async connectBlade(): Promise<WalletConnectionResult> {
    try {
      logger.info('Attempting Blade Wallet connection');

      // Check if Blade Wallet is installed
      if (!window.blade) {
        logger.warn('Blade Wallet extension not found');
        return {
          success: false,
          error: 'Blade Wallet extension not installed. Please install from Chrome Web Store.'
        };
      }

      // Initialize Blade Wallet connection
      const bladeApi = window.blade;

      // Request connection
      const connectionResult = await bladeApi.createAccount(this.network);

      if (!connectionResult.success) {
        logger.error('Blade Wallet connection failed:', connectionResult.error);
        return {
          success: false,
          error: connectionResult.error || 'Failed to connect to Blade Wallet'
        };
      }

      // Get account information
      const accountId = connectionResult.accountId;
      const walletAccounts: WalletAccount[] = [{
        accountId: accountId,
        evmAddress: connectionResult.evmAddress,
        publicKey: connectionResult.publicKey,
        walletId: 'blade'
      }];

      logger.info('Blade Wallet connected successfully', {
        accountId: accountId,
        network: this.network
      });

      return {
        success: true,
        wallet: {
          id: 'blade',
          name: 'Blade Wallet',
          description: 'Connected to Blade Wallet',
          isInstalled: true,
          isAvailable: true
        },
        accounts: walletAccounts
      };

    } catch (error: any) {
      logger.error('Blade Wallet connection error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error connecting to Blade Wallet'
      };
    }
  }

  private async disconnectBlade(): Promise<void> {
    try {
      logger.info('Disconnecting from Blade Wallet');

      if (window.blade && window.blade.disconnect) {
        await window.blade.disconnect();
        logger.info('Blade Wallet disconnected successfully');
      } else {
        logger.warn('Blade Wallet disconnect method not available');
      }

      // Clear connection state
      this.connectedWallet = null;
      this.connectedAccounts = [];

    } catch (error: any) {
      logger.error('Blade Wallet disconnection error:', error);
      // Continue anyway to clear local state
      this.connectedWallet = null;
      this.connectedAccounts = [];
    }
  }

  private async signWithBlade(request: TransactionRequest): Promise<TransactionResult> {
    try {
      logger.info('Signing transaction with Blade Wallet', { type: request.type, network: request.network });

      if (!window.blade) {
        return {
          success: false,
          error: 'Blade Wallet extension not available'
        };
      }

      if (!this.connectedAccounts.length) {
        return {
          success: false,
          error: 'No Blade Wallet accounts connected'
        };
      }

      // Prepare transaction based on type
      let transactionResult;
      const accountId = this.connectedAccounts[0].accountId;

      switch (request.type) {
        case 'transfer':
          transactionResult = await window.blade.transferHbars(
            accountId,
            request.data.toAccountId,
            request.data.amount,
            request.data.memo || ''
          );
          break;
        case 'token-create':
          transactionResult = await window.blade.createToken(
            request.data.name,
            request.data.symbol,
            request.data.decimals,
            request.data.initialSupply,
            accountId
          );
          break;
        case 'contract-call':
          transactionResult = await window.blade.contractCallFunction(
            request.data.contractId,
            request.data.functionName,
            request.data.parameters,
            accountId,
            request.data.gas || 100000
          );
          break;
        default:
          return {
            success: false,
            error: `Unsupported transaction type: ${request.type}`
          };
      }

      if (!transactionResult.success) {
        logger.error('Blade Wallet transaction failed:', transactionResult.error);
        return {
          success: false,
          error: transactionResult.error || 'Transaction failed'
        };
      }

      logger.info('Blade Wallet transaction completed successfully', {
        transactionId: transactionResult.transactionId,
        type: request.type
      });

      return {
        success: true,
        transactionId: transactionResult.transactionId,
        receipt: transactionResult.receipt
      };

    } catch (error: any) {
      logger.error('Blade Wallet transaction signing error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error signing transaction'
      };
    }
  }

  // ========================================
  // WalletConnect Integration
  // ========================================

  private async connectWalletConnect(): Promise<WalletConnectionResult> {
    try {
      logger.info('Attempting WalletConnect v2 connection');

      // Initialize WalletConnect client if not already done
      if (!this.walletConnectClient) {
        await this.initializeWalletConnect();
      }

      if (!this.walletConnectClient) {
        return {
          success: false,
          error: 'Failed to initialize WalletConnect client'
        };
      }

      // Check for existing sessions
      const existingSessions = this.walletConnectClient.session.getAll();
      if (existingSessions.length > 0) {
        const session = existingSessions[0];
        this.walletConnectSession = session;

        const accounts = this.extractAccountsFromSession(session);

        logger.info('WalletConnect reconnected to existing session', {
          accountsCount: accounts.length,
          walletName: session.peer.metadata.name
        });

        return {
          success: true,
          wallet: {
            id: 'walletconnect',
            name: session.peer.metadata.name,
            description: `Connected via WalletConnect to ${session.peer.metadata.name}`,
            isInstalled: true,
            isAvailable: true
          },
          accounts
        };
      }

      // Create new connection
      const { uri, approval } = await this.walletConnectClient.connect({
        requiredNamespaces: {
          hedera: {
            methods: ['hedera_getAccountInfo', 'hedera_signTransaction'],
            chains: [`hedera:${this.network}`],
            events: ['accountsChanged', 'chainChanged']
          }
        }
      });

      if (uri) {
        logger.info('WalletConnect URI generated, showing QR code');
        QRCodeModal.open(uri, () => {
          logger.info('WalletConnect QR modal closed');
        });
      }

      // Wait for wallet approval
      const session = await approval();
      this.walletConnectSession = session;

      QRCodeModal.close();

      const accounts = this.extractAccountsFromSession(session);

      logger.info('WalletConnect connected successfully', {
        accountsCount: accounts.length,
        walletName: session.peer.metadata.name,
        network: this.network
      });

      return {
        success: true,
        wallet: {
          id: 'walletconnect',
          name: session.peer.metadata.name,
          description: `Connected via WalletConnect to ${session.peer.metadata.name}`,
          isInstalled: true,
          isAvailable: true
        },
        accounts
      };

    } catch (error: any) {
      logger.error('WalletConnect connection error:', error);
      QRCodeModal.close();
      return {
        success: false,
        error: error.message || 'Failed to connect via WalletConnect'
      };
    }
  }

  private async initializeWalletConnect(): Promise<void> {
    try {
      this.walletConnectClient = await SignClient.init({
        projectId: this.projectId,
        metadata: {
          name: 'APIX AI',
          description: 'Enterprise AI-powered Hedera development assistant',
          url: 'https://hedera.com',
          icons: ['https://hedera.com/logo.png']
        }
      });

      logger.info('WalletConnect v2 client initialized', {
        projectId: this.projectId,
        network: this.network
      });
    } catch (error: any) {
      logger.error('WalletConnect client initialization failed:', error);
      throw error;
    }
  }

  private extractAccountsFromSession(session: any): WalletAccount[] {
    try {
      const hederaNamespace = session.namespaces.hedera;
      if (!hederaNamespace || !hederaNamespace.accounts) {
        return [];
      }

      return hederaNamespace.accounts.map((account: string) => {
        // Account format: "hedera:testnet:0.0.123456"
        const parts = account.split(':');
        const accountId = parts[parts.length - 1];

        return {
          accountId,
          walletId: 'walletconnect'
        };
      });
    } catch (error) {
      logger.warn('Failed to extract accounts from WalletConnect session:', error);
      return [];
    }
  }

  private async disconnectWalletConnect(): Promise<void> {
    try {
      logger.info('Disconnecting from WalletConnect');

      if (this.walletConnectClient && this.walletConnectSession) {
        await this.walletConnectClient.disconnect({
          topic: this.walletConnectSession.topic,
          reason: getSdkError('USER_DISCONNECTED')
        });

        logger.info('WalletConnect session disconnected successfully');
      } else {
        logger.warn('No active WalletConnect session to disconnect');
      }

      // Clear connection state
      this.walletConnectSession = null;
      this.connectedWallet = null;
      this.connectedAccounts = [];

    } catch (error: any) {
      logger.error('WalletConnect disconnection error:', error);
      // Continue anyway to clear local state
      this.walletConnectSession = null;
      this.connectedWallet = null;
      this.connectedAccounts = [];
    }
  }

  private async signWithWalletConnect(request: TransactionRequest): Promise<TransactionResult> {
    try {
      logger.info('Signing transaction with WalletConnect', { type: request.type, network: request.network });

      if (!this.walletConnectClient || !this.walletConnectSession) {
        return {
          success: false,
          error: 'WalletConnect not connected'
        };
      }

      if (!this.connectedAccounts.length) {
        return {
          success: false,
          error: 'No WalletConnect accounts available'
        };
      }

      const accountId = this.connectedAccounts[0].accountId;

      // Prepare transaction data for WalletConnect
      const transactionData = {
        from: accountId,
        ...request.data
      };

      // Send transaction request to connected wallet
      const result = await this.walletConnectClient.request({
        topic: this.walletConnectSession.topic,
        chainId: `hedera:${this.network}`,
        request: {
          method: 'hedera_signTransaction',
          params: {
            type: request.type,
            transaction: transactionData,
            network: request.network
          }
        }
      }) as { transactionId: string; receipt?: any };

      logger.info('WalletConnect transaction signed successfully', {
        transactionId: result.transactionId,
        type: request.type,
        accountId
      });

      return {
        success: true,
        transactionId: result.transactionId,
        receipt: result.receipt
      };

    } catch (error: any) {
      logger.error('WalletConnect transaction signing error:', error);
      return {
        success: false,
        error: error.message || 'Transaction signing failed via WalletConnect'
      };
    }
  }

  // ========================================
  // MetaMask Snap Integration
  // ========================================

  private async isMetaMaskSnapAvailable(): Promise<boolean> {
    try {
      // Check if MetaMask with Hedera Snap is available
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const ethereum = (window as any).ethereum;

        // Check if MetaMask is installed
        if (!ethereum.isMetaMask) {
          return false;
        }

        try {
          // Check if Hedera Snap is installed
          const snaps = await ethereum.request({
            method: 'wallet_getSnaps'
          });

          // Look for Hedera Snap
          const hederaSnapId = 'npm:@hashgraph/hedera-wallet-snap';
          return snaps && snaps[hederaSnapId];
        } catch (error: any) {
          logger.debug('Error checking MetaMask Snap availability:', error);
          return false;
        }
      }
      return false;
    } catch (error: any) {
      logger.debug('MetaMask Snap availability check failed:', error);
      return false;
    }
  }

  private async connectMetaMaskSnap(): Promise<WalletConnectionResult> {
    try {
      logger.info('Attempting MetaMask Hedera Snap connection');

      if (typeof window === 'undefined' || !(window as any).ethereum) {
        return {
          success: false,
          error: 'MetaMask not available. Please install MetaMask browser extension.'
        };
      }

      const ethereum = (window as any).ethereum;

      // Check if MetaMask is available
      if (!ethereum.isMetaMask) {
        return {
          success: false,
          error: 'MetaMask not detected. Please install MetaMask browser extension.'
        };
      }

      // Install/Connect to Hedera Snap
      const snapId = 'npm:@hashgraph/hedera-wallet-snap';

      try {
        // Request connection to the Hedera Snap
        const snapResponse = await ethereum.request({
          method: 'wallet_requestSnaps',
          params: {
            [snapId]: {}
          }
        });

        if (!snapResponse || !snapResponse[snapId]) {
          return {
            success: false,
            error: 'Failed to connect to Hedera Snap. Please try again or install the Hedera Snap manually.'
          };
        }

        // Get accounts from the snap
        const accounts = await ethereum.request({
          method: 'wallet_invokeSnap',
          params: {
            snapId,
            request: {
              method: 'hts.getAccountInfo',
              params: {
                network: this.network
              }
            }
          }
        });

        if (!accounts || !accounts.accountId) {
          return {
            success: false,
            error: 'Failed to retrieve account information from MetaMask Hedera Snap'
          };
        }

        // Store connection info
        this.connectedWallet = {
          id: 'metamask-snap',
          name: 'MetaMask Hedera Snap',
          description: 'Use MetaMask with Hedera through a Snap extension',
          isInstalled: true,
          isAvailable: true
        };

        this.connectedAccounts = [{
          accountId: accounts.accountId,
          publicKey: accounts.publicKey || '',
          evmAddress: accounts.evmAddress || '',
          walletId: 'metamask-snap'
        }];

        logger.info('MetaMask Hedera Snap connected successfully', {
          accountId: accounts.accountId,
          network: this.network
        });

        return {
          success: true,
          wallet: this.connectedWallet || undefined,
          accounts: this.connectedAccounts
        };

      } catch (snapError: any) {
        logger.error('Hedera Snap connection error:', snapError);

        if (snapError.code === 4001) {
          return {
            success: false,
            error: 'User rejected the connection request'
          };
        }

        if (snapError.message?.includes('not installed')) {
          return {
            success: false,
            error: 'Hedera Snap is not installed. Please install it from the MetaMask Snap directory.'
          };
        }

        return {
          success: false,
          error: `MetaMask Snap connection failed: ${snapError.message || 'Unknown error'}`
        };
      }

    } catch (error: any) {
      logger.error('MetaMask Snap connection failed:', error);
      return {
        success: false,
        error: `MetaMask connection failed: ${error.message}`
      };
    }
  }

  private async signWithMetaMaskSnap(request: TransactionRequest): Promise<TransactionResult> {
    try {
      logger.info('Signing transaction with MetaMask Hedera Snap', {
        type: request.type,
        accountId: request.accountId
      });

      if (typeof window === 'undefined' || !(window as any).ethereum) {
        return {
          success: false,
          error: 'MetaMask not available'
        };
      }

      const ethereum = (window as any).ethereum;
      const snapId = 'npm:@hashgraph/hedera-wallet-snap';

      // Check if we have a connected account
      if (this.connectedAccounts.length === 0) {
        return {
          success: false,
          error: 'No connected accounts. Please connect MetaMask Hedera Snap first.'
        };
      }

      const accountId = this.connectedAccounts[0].accountId;

      // Prepare transaction data based on type
      let snapMethod = '';
      let transactionParams: any = {};

      switch (request.type) {
        case 'hts-create':
          snapMethod = 'hts.createToken';
          transactionParams = {
            name: request.data.name,
            symbol: request.data.symbol,
            decimals: request.data.decimals || 8,
            initialSupply: request.data.initialSupply || 0,
            treasuryAccountId: accountId,
            network: request.network || this.network
          };
          break;

        case 'hts-transfer':
          snapMethod = 'hts.transferToken';
          transactionParams = {
            tokenId: request.data.tokenId,
            from: accountId,
            to: request.data.to,
            amount: request.data.amount,
            network: request.network || this.network
          };
          break;

        case 'hbar-transfer':
          snapMethod = 'hbar.transfer';
          transactionParams = {
            from: accountId,
            to: request.data.to,
            amount: request.data.amount,
            network: request.network || this.network
          };
          break;

        case 'smart-contract-call':
          snapMethod = 'contract.call';
          transactionParams = {
            contractId: request.data.contractId,
            functionName: request.data.functionName,
            parameters: request.data.parameters || [],
            gas: request.data.gas || 100000,
            from: accountId,
            network: request.network || this.network
          };
          break;

        default:
          return {
            success: false,
            error: `Unsupported transaction type: ${request.type}`
          };
      }

      // Execute transaction through MetaMask Snap
      try {
        const result = await ethereum.request({
          method: 'wallet_invokeSnap',
          params: {
            snapId,
            request: {
              method: snapMethod,
              params: transactionParams
            }
          }
        });

        if (!result || !result.transactionId) {
          return {
            success: false,
            error: 'Transaction failed or was rejected'
          };
        }

        logger.info('MetaMask Snap transaction completed successfully', {
          transactionId: result.transactionId,
          type: request.type,
          accountId
        });

        return {
          success: true,
          transactionId: result.transactionId,
          receipt: result.receipt || null,
          explorerUrl: `https://hashscan.io/${this.network}/transaction/${result.transactionId}`
        };

      } catch (snapError: any) {
        logger.error('MetaMask Snap transaction error:', snapError);

        if (snapError.code === 4001) {
          return {
            success: false,
            error: 'User rejected the transaction'
          };
        }

        if (snapError.message?.includes('insufficient')) {
          return {
            success: false,
            error: 'Insufficient balance to complete transaction'
          };
        }

        if (snapError.message?.includes('not found')) {
          return {
            success: false,
            error: 'Token or contract not found'
          };
        }

        return {
          success: false,
          error: `Transaction failed: ${snapError.message || 'Unknown error'}`
        };
      }

    } catch (error: any) {
      logger.error('MetaMask Snap signing failed:', error);
      return {
        success: false,
        error: `Signing failed: ${error.message}`
      };
    }
  }

  /**
   * Disconnect MetaMask Snap
   */
  private async disconnectMetaMaskSnap(): Promise<void> {
    try {
      logger.info('Disconnecting MetaMask Hedera Snap');

      // MetaMask Snap connections don't require explicit disconnection
      // The connection state is managed by MetaMask itself
      // We just need to clear our local connection data

      logger.info('MetaMask Hedera Snap disconnected successfully');
    } catch (error: any) {
      logger.error('MetaMask Snap disconnection error:', error);
      // Don't throw - disconnection should always succeed locally
    }
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Check if running in browser environment
   */
  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * Get wallet-specific configuration
   */
  getWalletConfig(walletId: string): any {
    const configs = {
      hashpack: {
        appMetadata: {
          name: 'APIX AI',
          description: 'Enterprise AI-powered Hedera development platform',
          icon: 'https://your-domain.com/icon.png'
        },
        network: this.network
      },
      blade: {
        dAppCode: 'your-dapp-code',
        network: this.network,
        bladeEnv: this.network === 'mainnet' ? 'Mainnet' : 'Testnet'
      },
      walletconnect: {
        projectId: 'your-walletconnect-project-id',
        chains: this.network === 'mainnet' ? ['hedera:mainnet'] : ['hedera:testnet'],
        metadata: {
          name: 'APIX AI',
          description: 'Enterprise AI-powered Hedera development platform',
          url: 'https://your-domain.com',
          icons: ['https://your-domain.com/icon.png']
        }
      }
    };

    return configs[walletId as keyof typeof configs] || {};
  }
}

// Export singleton instance
export const walletIntegration = new WalletIntegrationService(
  (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet'
);

// Helper functions
export async function getSupportedWallets(): Promise<WalletInfo[]> {
  return await walletIntegration.getSupportedWallets();
}

export async function connectWallet(walletId: string): Promise<WalletConnectionResult> {
  return await walletIntegration.connectWallet(walletId);
}

export async function disconnectWallet(): Promise<void> {
  return await walletIntegration.disconnectWallet();
}

export async function signTransaction(request: TransactionRequest): Promise<TransactionResult> {
  return await walletIntegration.signTransaction(request);
}

export function getConnectedWallet(): WalletInfo | null {
  return walletIntegration.getConnectedWallet();
}

export function getConnectedAccounts(): WalletAccount[] {
  return walletIntegration.getConnectedAccounts();
}