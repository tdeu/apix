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
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { hederaOperations } from '../src/services/hedera-operations';
import { maskSecrets } from '../src/utils/secrets';

const MIRROR = 'https://testnet.mirrornode.hedera.com/api/v1';
const HASHSCAN = 'https://hashscan.io/testnet';
const SMOKE = process.argv.includes('--smoke');

type Status = 'ok' | 'failed';

interface ProofStep {
  operation: string;
  status: Status;
  entityId?: string;
  transactionId?: string;
  hashscan?: string;
  mirrorVerified: boolean;
  notes: string[];
  error?: string;
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

/** Mirror record of a transaction: its result and consensus timestamp */
async function mirrorTransaction(transactionId: string): Promise<{ result: string; consensus: string } | null> {
  const body = await mirror<any>(`/transactions/${mirrorTxId(transactionId)}`, b => (b.transactions?.length ?? 0) > 0);
  const tx = body?.transactions?.[0];
  return tx ? { result: tx.result, consensus: tx.consensus_timestamp } : null;
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

async function main(): Promise<void> {
  const network = process.env.HEDERA_NETWORK;
  if (network !== 'testnet') {
    console.error(`STOP: HEDERA_NETWORK is "${network ?? ''}", not "testnet". This proof only runs on testnet.`);
    process.exit(1);
  }
  const operator = process.env.HEDERA_ACCOUNT_ID ?? '';
  const recipient = process.env.APIX_DEMO_RECIPIENT ?? '';
  const startedAt = new Date().toISOString();
  console.log(`Testnet proof ${SMOKE ? '(smoke) ' : ''}started ${startedAt}, operator ${operator}`);

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

  const sdkVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'node_modules', '@hashgraph', 'sdk', 'package.json'), 'utf8')).version;
  const report = { startedAt, finishedAt: new Date().toISOString(), network, operator, recipient, sdkVersion, smoke: SMOKE, steps };
  if (!SMOKE) {
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
