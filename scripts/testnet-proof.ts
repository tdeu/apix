/**
 * Testnet proof: runs APIX's own hedera-operations against Hedera testnet and
 * verifies every result on the mirror node. Run with `npm run proof:testnet`.
 *
 * Needs HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY and APIX_DEMO_RECIPIENT in .env.
 * Refuses to run unless HEDERA_NETWORK is testnet. Failures are recorded as
 * they happen (secrets masked), never worked around; the script exits 1 if
 * any step failed. Results go to docs/testnet-proof.json.
 *
 * `--smoke` (used by the nightly CI job) only creates a token and a topic and
 * submits one message.
 *
 * APIX_PROOF_ROOT=<dir of an installed apix-hedera> runs the same steps with
 * that installation's compiled code and its own node_modules (the tree a user
 * gets) instead of this repository's sources. docs/testnet-proof.json is left
 * alone in that mode.
 *
 * APIX_ENV_FILE=<path> loads the environment from that file instead of .env
 * (e.g. credentials kept outside the repository).
 *
 * Mainnet mode spends REAL HBAR. It runs only when HEDERA_NETWORK=mainnet and
 * both --mainnet and --i-understand-this-spends-real-hbar are given
 * (src/proof/proof-mode.ts); anything else is refused. It checks the balance
 * on the mainnet mirror node first (at least 25 HBAR), then creates one token,
 * mints once, creates one topic and submits one message: no contract, no
 * transfer. It stops at the first failed step and never retries. Results go
 * to docs/mainnet-proof.json.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import type { HederaOperationsService } from '../src/services/hedera-operations';
import { MAINNET_MIN_BALANCE_HBAR, resolveProofMode } from '../src/proof/proof-mode';
import { maskSecrets } from '../src/utils/secrets';

// The environment is loaded before hedera-operations, which reads
// HEDERA_NETWORK when it is first required
if (process.env.APIX_ENV_FILE) {
  const loaded = dotenv.config({ path: process.env.APIX_ENV_FILE, override: true });
  if (loaded.error) {
    console.error(`STOP: cannot read APIX_ENV_FILE (${process.env.APIX_ENV_FILE}). Nothing was run.`);
    process.exit(1);
  }
} else {
  dotenv.config();
}

const MODE = resolveProofMode(process.env.HEDERA_NETWORK, process.argv.slice(2));
if (MODE.run === 'refuse') {
  console.error(`STOP: ${MODE.reason}`);
  process.exit(1);
}
const NETWORK = MODE.run;
const SMOKE = MODE.run === 'testnet' && MODE.smoke;

const INSTALLED_ROOT = process.env.APIX_PROOF_ROOT ? path.resolve(process.env.APIX_PROOF_ROOT) : undefined;
const hederaOperations: HederaOperationsService = INSTALLED_ROOT
  ? require(path.join(INSTALLED_ROOT, 'dist', 'services', 'hedera-operations')).hederaOperations
  : require('../src/services/hedera-operations').hederaOperations;

const MIRROR = `https://${NETWORK}.mirrornode.hedera.com/api/v1`;
const HASHSCAN = `https://hashscan.io/${NETWORK}`;
const TINYBARS_PER_HBAR = 100_000_000;

type Status = 'ok' | 'failed';

interface ProofStep {
  operation: string;
  status: Status;
  entityId?: string;
  transactionId?: string;
  /** Fee the network charged, from the mirror node, in tinybars */
  chargedFeeTinybar?: number;
  hashscan?: string;
  mirrorVerified: boolean;
  notes: string[];
  error?: string;
}

/** 123456789 tinybars -> "1.23456789" */
function hbar(tinybars: number): string {
  return (tinybars / TINYBARS_PER_HBAR).toFixed(8);
}

const steps: ProofStep[] = [];

function record(step: ProofStep): ProofStep {
  steps.push(step);
  const mark = step.status === 'ok' ? '✅' : '❌';
  console.log(`${mark} ${step.operation}: ${step.entityId ?? ''} ${step.transactionId ?? ''} mirror=${step.mirrorVerified ? 'yes' : 'no'}`);
  for (const note of step.notes) console.log(`   ${note}`);
  if (step.error) console.log(`   error: ${step.error}`);
  return step;
}

function masked(error: unknown): string {
  return maskSecrets(error instanceof Error ? error.message : String(error));
}

/** 0.0.123@1700000000.000000001 -> 0.0.123-1700000000-000000001 (mirror node form) */
function mirrorTxId(transactionId: string): string {
  const [account, time] = transactionId.split('@');
  return `${account}-${time.replace('.', '-')}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/** GET from the mirror node, retrying while it hasn't ingested the record yet */
async function mirror<T = any>(urlPath: string, ready: (body: T) => boolean = () => true, attempts = 20): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    const response = await fetch(`${MIRROR}${urlPath}`);
    if (response.ok) {
      const body = (await response.json()) as T;
      if (ready(body)) return body;
    } else if (response.status !== 404) {
      throw new Error(`mirror node ${urlPath}: HTTP ${response.status}`);
    }
    await sleep(3000);
  }
  return null;
}

/** Mirror record of a transaction: its result, consensus timestamp and charged fee */
async function mirrorTransaction(transactionId: string): Promise<{ result: string; consensus: string; chargedFee?: number } | null> {
  // One transaction ID can have several records: the transaction itself
  // (nonce 0) and child records (nonce > 0), such as the zero-fee account
  // update that completes a hollow account on its first transaction. The
  // child can come first, so pick the record by nonce, not by position.
  const isUserTransaction = (t: any): boolean => t.nonce === 0;
  const body = await mirror<any>(`/transactions/${mirrorTxId(transactionId)}`, b => (b.transactions ?? []).some(isUserTransaction));
  const tx = body?.transactions?.find(isUserTransaction);
  return tx ? { result: tx.result, consensus: tx.consensus_timestamp, chargedFee: tx.charged_tx_fee } : null;
}

/** Checks the step's transaction on the mirror node; returns its consensus timestamp */
async function verifyTransaction(step: ProofStep, linkToTransaction: boolean): Promise<string | undefined> {
  if (!step.transactionId) {
    step.notes.push('no transaction ID returned');
    step.mirrorVerified = false;
    return undefined;
  }
  const tx = await mirrorTransaction(step.transactionId);
  if (!tx) {
    step.notes.push('transaction not found on the mirror node within 60s');
    step.mirrorVerified = false;
    return undefined;
  }
  step.notes.push(`mirror: transaction result ${tx.result}, consensus ${tx.consensus}`);
  if (typeof tx.chargedFee === 'number') {
    step.chargedFeeTinybar = tx.chargedFee;
    step.notes.push(`mirror: charged fee ${hbar(tx.chargedFee)} HBAR`);
  }
  step.mirrorVerified = tx.result === 'SUCCESS';
  if (linkToTransaction) step.hashscan = `${HASHSCAN}/transaction/${tx.consensus}`;
  return tx.consensus;
}

/** Runs one step: `body` fills it in and throws on failure */
async function runStep(operation: string, body: (step: ProofStep) => Promise<void>): Promise<ProofStep> {
  const step: ProofStep = { operation, status: 'failed', mirrorVerified: false, notes: [] };
  try {
    await body(step);
    step.status = 'ok';
  } catch (error) {
    step.error = masked(error);
    step.mirrorVerified = false;
  }
  return record(step);
}

// --- Solidity -------------------------------------------------------------

const STRING_STORE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StringStore {
    string private value;

    function set(string calldata newValue) external {
        value = newValue;
    }

    function get() external view returns (string memory) {
        return value;
    }
}
`;

function compileStringStore(): { bytecode: string; selectors: Record<string, string>; compiler: string } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const solc = require('solc');
  const input = {
    language: 'Solidity',
    sources: { 'StringStore.sol': { content: STRING_STORE } },
    settings: {
      evmVersion: 'cancun',
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['evm.bytecode.object', 'evm.methodIdentifiers'] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors ?? []).filter((e: any) => e.severity === 'error');
  if (errors.length > 0) throw new Error(`solc: ${errors.map((e: any) => e.formattedMessage).join('\n')}`);
  const contract = output.contracts['StringStore.sol'].StringStore;
  return { bytecode: contract.evm.bytecode.object, selectors: contract.evm.methodIdentifiers, compiler: solc.version() };
}

/** Decode an ABI-encoded single `string` return value */
function decodeAbiString(hex: string): string {
  const data = hex.replace(/^0x/, '');
  if (data.length < 128) return '';
  const offset = parseInt(data.slice(0, 64), 16) * 2;
  const length = parseInt(data.slice(offset, offset + 64), 16);
  return Buffer.from(data.slice(offset + 64, offset + 64 + length * 2), 'hex').toString('utf8');
}

function require_<T>(value: T | undefined, what: string): T {
  if (value === undefined || value === null || value === '') throw new Error(`skipped: no ${what} from an earlier step`);
  return value;
}

// --- Proof ----------------------------------------------------------------

function sdkVersion(): string {
  return JSON.parse(fs.readFileSync(path.join(INSTALLED_ROOT ?? path.join(__dirname, '..'), 'node_modules', '@hashgraph', 'sdk', 'package.json'), 'utf8')).version;
}

/** Balance and key of an account, from the mirror node */
async function mirrorAccount(accountId: string): Promise<{ balanceTinybar: number; keyType: string | null }> {
  const response = await fetch(`${MIRROR}/accounts/${accountId}`);
  if (!response.ok) throw new Error(`mirror node /accounts/${accountId}: HTTP ${response.status}`);
  const body: any = await response.json();
  const balance = body.balance?.balance;
  if (typeof balance !== 'number') throw new Error(`mirror node /accounts/${accountId}: no balance in the response`);
  return { balanceTinybar: balance, keyType: body.key?._type ?? null };
}

/**
 * Mainnet proof: real HBAR. Minimal on purpose (token, mint, topic, one
 * message), stops at the first step that fails or isn't confirmed by the
 * mirror node, and never retries.
 */
async function mainnetProof(): Promise<void> {
  const operator = process.env.HEDERA_ACCOUNT_ID ?? '';
  if (!operator) {
    console.error('STOP: HEDERA_ACCOUNT_ID is not set. Nothing was run.');
    process.exit(1);
  }
  const startedAt = new Date().toISOString();
  console.log(`MAINNET proof started ${startedAt}. This spends real HBAR.`);

  const before = await mirrorAccount(operator);
  console.log(`Operator ${operator}: balance ${hbar(before.balanceTinybar)} HBAR, key on the mirror node: ${before.keyType ?? 'none (hollow account)'}`);
  if (before.balanceTinybar < MAINNET_MIN_BALANCE_HBAR * TINYBARS_PER_HBAR) {
    console.error(`STOP: the balance is under ${MAINNET_MIN_BALANCE_HBAR} HBAR. Nothing was run.`);
    process.exit(1);
  }

  await hederaOperations.initialize();
  if (hederaOperations.getNetwork() !== 'mainnet') {
    hederaOperations.close();
    console.error(`STOP: the Hedera client is configured for ${hederaOperations.getNetwork()}, not mainnet. Nothing was run.`);
    process.exit(1);
  }

  const succeeded = (step: ProofStep): boolean => step.status === 'ok' && step.mirrorVerified;
  let tokenId: string | undefined;
  let topicId: string | undefined;
  const message = `APIX mainnet proof ${startedAt}`;

  // Each entry runs only if every earlier one succeeded
  const plan: Array<() => Promise<ProofStep>> = [
    // a) 10.00 APIXM, infinite supply, operator holds the admin and supply keys
    () => runStep('Create fungible token APIX Mainnet Proof / APIXM (admin + supply key)', async step => {
      const result = await hederaOperations.createToken({
        name: 'APIX Mainnet Proof', symbol: 'APIXM', decimals: 2, initialSupply: 1000, adminKey: true, supplyKey: true,
      });
      if (!result.success) throw new Error(result.error);
      tokenId = result.tokenId;
      step.entityId = tokenId;
      step.transactionId = result.transactionId;
      step.hashscan = `${HASHSCAN}/token/${tokenId}`;
      await verifyTransaction(step, false);
      const token = await mirror<any>(`/tokens/${tokenId}`);
      if (!token) throw new Error('token not found on the mirror node within 60s');
      const checks = {
        name: token.name === 'APIX Mainnet Proof' && token.symbol === 'APIXM',
        decimals: String(token.decimals) === '2',
        treasury: token.treasury_account_id === operator,
        supplyKey: !!token.supply_key,
        adminKey: !!token.admin_key,
        infinite: token.supply_type === 'INFINITE',
        supply: token.total_supply === '1000',
      };
      step.notes.push(
        `mirror: "${token.name}" ${token.symbol}, decimals ${token.decimals}, supply ${token.total_supply} (${token.supply_type}), ` +
        `treasury ${token.treasury_account_id}, admin key ${checks.adminKey ? 'set' : 'none'}, supply key ${checks.supplyKey ? 'set' : 'none'}`
      );
      step.mirrorVerified = step.mirrorVerified && Object.values(checks).every(Boolean);
    }),
    // b) Mint 100 units
    () => runStep('Mint 1.00 APIXM (100 units)', async step => {
      const id = require_(tokenId, 'token ID');
      const result = await hederaOperations.mintToken({ tokenId: id, amount: 100 });
      if (!result.success) throw new Error(result.error);
      step.entityId = id;
      step.transactionId = result.transactionId;
      step.notes.push(`receipt: new total supply ${result.details?.totalSupply}`);
      await verifyTransaction(step, true);
      const token = await mirror<any>(`/tokens/${id}`, b => b.total_supply === '1100');
      step.notes.push(`mirror: total supply ${token ? token.total_supply : 'not 1100 within 60s'}`);
      if (!token) step.mirrorVerified = false;
    }),
    // c) HCS topic
    () => runStep('Create HCS topic', async step => {
      const result = await hederaOperations.createTopic({ memo: 'APIX mainnet proof' });
      if (!result.success) throw new Error(result.error);
      topicId = result.tokenId;
      step.entityId = topicId;
      step.transactionId = result.transactionId;
      step.hashscan = `${HASHSCAN}/topic/${topicId}`;
      await verifyTransaction(step, false);
      const topic = await mirror<any>(`/topics/${topicId}`);
      step.notes.push(topic ? `mirror: topic memo "${topic.memo}"` : 'topic not found on the mirror node within 60s');
      if (!topic || topic.memo !== 'APIX mainnet proof') step.mirrorVerified = false;
    }),
    // d) One message
    () => runStep('Submit topic message', async step => {
      const id = require_(topicId, 'topic ID');
      const result = await hederaOperations.submitTopicMessage({ topicId: id, message });
      if (!result.success) throw new Error(result.error);
      step.entityId = id;
      step.transactionId = result.transactionId;
      step.notes.push(`receipt: sequence ${result.details?.sequenceNumber}`);
      const consensus = await verifyTransaction(step, true);
      const found = consensus ? await mirror<any>(`/topics/${id}/messages?timestamp=${consensus}`, b => (b.messages?.length ?? 0) > 0) : null;
      const stored = found?.messages?.[0];
      const content = stored ? Buffer.from(stored.message, 'base64').toString('utf8') : undefined;
      step.notes.push(`mirror: ${stored ? `sequence ${stored.sequence_number} = ${JSON.stringify(content)}` : 'message not found'}`);
      if (content !== message) step.mirrorVerified = false;
    }),
  ];

  let stopped = false;
  for (const run of plan) {
    const step = await run();
    if (step.hashscan) console.log(`   ${step.hashscan}`);
    if (!succeeded(step)) {
      stopped = true;
      console.error('STOP: this step failed or was not confirmed by the mirror node. The remaining steps were not run, and nothing is retried.');
      break;
    }
  }

  hederaOperations.close();

  // Hollow account completion and what it all cost. The mirror node needs a
  // few seconds to show the last transaction, so this reads until the
  // balance has moved (or gives up and reports what it sees).
  let after = before;
  for (let attempt = 0; attempt < 10; attempt++) {
    after = await mirrorAccount(operator);
    if (after.balanceTinybar !== before.balanceTinybar || steps.every(step => !step.transactionId)) break;
    await sleep(3000);
  }
  const totalFeeTinybar = steps.reduce((sum, step) => sum + (step.chargedFeeTinybar ?? 0), 0);
  console.log(`\nOperator ${operator} after the run: balance ${hbar(after.balanceTinybar)} HBAR, key on the mirror node: ${after.keyType ?? 'none (still hollow)'}`);
  console.log(`Charged fees: ${hbar(totalFeeTinybar)} HBAR; balance change: ${hbar(before.balanceTinybar - after.balanceTinybar)} HBAR`);

  const version = sdkVersion();
  console.log(`@hashgraph/sdk ${version}`);
  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    network: 'mainnet',
    operator,
    sdkVersion: version,
    balanceBeforeTinybar: before.balanceTinybar,
    balanceAfterTinybar: after.balanceTinybar,
    balanceChangeTinybar: before.balanceTinybar - after.balanceTinybar,
    totalChargedFeeTinybar: totalFeeTinybar,
    operatorKeyBefore: before.keyType,
    operatorKeyAfter: after.keyType,
    stoppedEarly: stopped,
    steps,
  };
  const out = path.join(__dirname, '..', 'docs', 'mainnet-proof.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(`Results written to ${path.relative(process.cwd(), out)}`);

  console.log(`\n${steps.length} of ${plan.length} steps run: ${steps.filter(s => s.status === 'ok').length} ok, ${steps.filter(s => s.status === 'failed').length} failed, ${steps.filter(s => s.mirrorVerified).length} mirror-verified`);
  process.exit(stopped || steps.length !== plan.length || after.keyType === null ? 1 : 0);
}

async function main(): Promise<void> {
  if (NETWORK === 'mainnet') return mainnetProof();
  const network = NETWORK;
  const operator = process.env.HEDERA_ACCOUNT_ID ?? '';
  const recipient = process.env.APIX_DEMO_RECIPIENT ?? '';
  const startedAt = new Date().toISOString();
  console.log(`Testnet proof ${SMOKE ? '(smoke) ' : ''}started ${startedAt}, operator ${operator}`);
  if (INSTALLED_ROOT) console.log(`Using the installed tree at ${INSTALLED_ROOT}`);

  await hederaOperations.initialize();

  // a) Fungible token: 1,000.00 APIXP, operator holds the admin and supply keys
  let tokenId: string | undefined;
  await runStep('Create fungible token APIX Proof / APIXP (admin + supply key)', async step => {
    const result = await hederaOperations.createToken({
      name: 'APIX Proof', symbol: 'APIXP', decimals: 2, initialSupply: 100000, adminKey: true, supplyKey: true,
    });
    if (!result.success) throw new Error(result.error);
    tokenId = result.tokenId;
    step.entityId = tokenId;
    step.transactionId = result.transactionId;
    step.hashscan = `${HASHSCAN}/token/${tokenId}`;
    step.notes.push(`created via ${result.details?.method}; library link ${result.explorerUrl}`);
    await verifyTransaction(step, false);
    const token = await mirror<any>(`/tokens/${tokenId}`);
    if (!token) throw new Error('token not found on the mirror node within 60s');
    const checks = {
      treasury: token.treasury_account_id === operator,
      supplyKey: !!token.supply_key,
      adminKey: !!token.admin_key,
      infinite: token.supply_type === 'INFINITE',
      supply: token.total_supply === '100000',
    };
    step.notes.push(
      `mirror: "${token.name}" ${token.symbol}, decimals ${token.decimals}, supply ${token.total_supply} (${token.supply_type}), ` +
      `treasury ${token.treasury_account_id}, admin key ${checks.adminKey ? 'set' : 'none'}, supply key ${checks.supplyKey ? 'set' : 'none'}`
    );
    step.mirrorVerified = step.mirrorVerified && Object.values(checks).every(Boolean);
  });

  if (!SMOKE) {
    // b) Mint, then transfer to the demo recipient
    await runStep('Mint 50.00 APIXP (5000 units)', async step => {
      const id = require_(tokenId, 'token ID');
      const result = await hederaOperations.mintToken({ tokenId: id, amount: 5000 });
      if (!result.success) throw new Error(result.error);
      step.entityId = id;
      step.transactionId = result.transactionId;
      step.notes.push(`receipt: new total supply ${result.details?.totalSupply}`);
      await verifyTransaction(step, true);
      const token = await mirror<any>(`/tokens/${id}`, b => b.total_supply === '105000');
      step.notes.push(`mirror: total supply ${token ? token.total_supply : 'not 105000 within 60s'}`);
      if (!token) step.mirrorVerified = false;
    });

    await runStep(`Transfer 10.00 APIXP (1000 units) to ${recipient}`, async step => {
      const id = require_(tokenId, 'token ID');
      const to = require_(recipient, 'APIX_DEMO_RECIPIENT');
      const result = await hederaOperations.transferToken({ tokenId: id, fromAccount: operator, toAccount: to, amount: 1000 });
      if (!result.success) throw new Error(result.error);
      step.entityId = id;
      step.transactionId = result.transactionId;
      await verifyTransaction(step, true);
      const balances = await mirror<any>(`/tokens/${id}/balances?account.id=${to}`, b => (b.balances?.[0]?.balance ?? 0) > 0);
      const balance = balances?.balances?.[0]?.balance;
      step.notes.push(`mirror: recipient balance ${balance ?? 'not found'} (expected 1000)`);
      if (balance !== 1000) step.mirrorVerified = false;
    });
  }

  // c) HCS topic and messages
  let topicId: string | undefined;
  await runStep('Create HCS topic', async step => {
    const result = await hederaOperations.createTopic({ memo: 'APIX testnet proof' });
    if (!result.success) throw new Error(result.error);
    topicId = result.tokenId;
    step.entityId = topicId;
    step.transactionId = result.transactionId;
    step.hashscan = `${HASHSCAN}/topic/${topicId}`;
    step.notes.push(`library link ${result.explorerUrl}`);
    await verifyTransaction(step, false);
    const topic = await mirror<any>(`/topics/${topicId}`);
    step.notes.push(topic ? `mirror: topic memo "${topic.memo}"` : 'topic not found on the mirror node within 60s');
    if (!topic) step.mirrorVerified = false;
  });

  const messages = SMOKE ? ['APIX nightly smoke'] : ['APIX testnet proof: message 1', 'APIX testnet proof: message 2'];
  for (const [index, message] of messages.entries()) {
    await runStep(`Submit topic message ${index + 1}`, async step => {
      const id = require_(topicId, 'topic ID');
      const result = await hederaOperations.submitTopicMessage({ topicId: id, message });
      if (!result.success) throw new Error(result.error);
      step.entityId = id;
      step.transactionId = result.transactionId;
      step.notes.push(`receipt: sequence ${result.details?.sequenceNumber}`);
      const consensus = await verifyTransaction(step, true);
      // Found by consensus timestamp, so an earlier failed message doesn't shift the lookup
      const found = consensus ? await mirror<any>(`/topics/${id}/messages?timestamp=${consensus}`, b => (b.messages?.length ?? 0) > 0) : null;
      const stored = found?.messages?.[0];
      const content = stored ? Buffer.from(stored.message, 'base64').toString('utf8') : undefined;
      step.notes.push(`mirror: ${stored ? `sequence ${stored.sequence_number} = ${JSON.stringify(content)}` : 'message not found'}`);
      if (content !== message) step.mirrorVerified = false;
    });
  }

  // d) Real contract: compile, deploy, set, get
  if (!SMOKE) {
    const value = 'hello from APIX';
    let contractId: string | undefined;
    let evmAddress: string | undefined;
    let compiled: ReturnType<typeof compileStringStore> | undefined;

    await runStep('Deploy StringStore contract (solc)', async step => {
      compiled = compileStringStore();
      step.notes.push(`compiled with solc ${compiled.compiler}, ${compiled.bytecode.length / 2} bytes`);
      const result = await hederaOperations.deploySmartContract({ bytecode: compiled.bytecode, gas: 400000 });
      if (!result.success) throw new Error(result.error);
      contractId = result.tokenId;
      evmAddress = result.details?.evmAddress;
      step.entityId = contractId;
      step.transactionId = result.transactionId;
      step.hashscan = `${HASHSCAN}/contract/${contractId}`;
      step.notes.push(`library link ${result.explorerUrl}`);
      await verifyTransaction(step, false);
      const contract = await mirror<any>(`/contracts/${contractId}`);
      step.notes.push(contract ? `mirror: contract ${contract.contract_id}, evm ${contract.evm_address}` : 'contract not found on the mirror node within 60s');
      if (!contract) step.mirrorVerified = false;
    });

    await runStep(`Call set("${value}")`, async step => {
      const id = require_(contractId, 'contract ID');
      const result = await hederaOperations.callSmartContract({
        contractId: id, functionName: 'set', gas: 100000, parameters: [{ type: 'string', value }],
      });
      if (!result.success) throw new Error(result.error);
      step.entityId = id;
      step.transactionId = result.transactionId;
      step.notes.push(`receipt status ${result.details?.receiptStatus}`);
      await verifyTransaction(step, true);
    });

    await runStep('Call get() and check the round trip', async step => {
      const id = require_(contractId, 'contract ID');
      step.entityId = id;
      step.hashscan = `${HASHSCAN}/contract/${id}`;
      const read = await hederaOperations.queryContract({ contractId: id, functionName: 'get', returns: 'string' });
      step.notes.push(`library queryContract: get() = ${JSON.stringify(read.value)}`);
      if (read.value !== value) throw new Error(`get() returned ${JSON.stringify(read.value)}, expected ${JSON.stringify(value)}`);

      // Independent check through the mirror node's eth_call
      const response = await fetch(`${MIRROR}/contracts/call`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: require_(evmAddress, 'EVM address'), data: `0x${compiled!.selectors['get()']}`, block: 'latest' }),
      });
      const body: any = await response.json();
      const stored = response.ok ? decodeAbiString(body.result ?? '') : undefined;
      step.notes.push(`mirror eth_call: get() = ${stored === undefined ? `HTTP ${response.status}` : JSON.stringify(stored)}`);
      step.mirrorVerified = stored === value;
    });
  }

  hederaOperations.close();

  const version = sdkVersion();
  const report = { startedAt, finishedAt: new Date().toISOString(), network, operator, recipient, sdkVersion: version, smoke: SMOKE, steps };
  console.log(`@hashgraph/sdk ${version}`);
  if (!SMOKE && !INSTALLED_ROOT) {
    const out = path.join(__dirname, '..', 'docs', 'testnet-proof.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    console.log(`Results written to ${path.relative(process.cwd(), out)}`);
  }

  const failed = steps.filter(step => step.status === 'failed' || !step.mirrorVerified);
  console.log(`\n${steps.length} steps: ${steps.filter(s => s.status === 'ok').length} ok, ${steps.filter(s => s.status === 'failed').length} failed, ${steps.filter(s => s.mirrorVerified).length} mirror-verified`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error(`Proof aborted: ${masked(error)}`);
  process.exit(1);
});
