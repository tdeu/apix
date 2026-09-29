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

type Status = 'ok' | 'failed' | 'unavailable';

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
  const mark = step.status === 'ok' ? '✅' : step.status === 'unavailable' ? '⚪' : '❌';
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

function txLink(consensus?: string, transactionId?: string): string | undefined {
  if (consensus) return `${HASHSCAN}/transaction/${consensus}`;
  return transactionId ? `${HASHSCAN}/transaction/${mirrorTxId(transactionId)}` : undefined;
}

async function verifyTransaction(step: ProofStep): Promise<void> {
  if (!step.transactionId) {
    step.notes.push('no transaction ID returned, so the transaction could not be checked on the mirror node');
    return;
  }
  const tx = await mirrorTransaction(step.transactionId);
  if (!tx) {
    step.notes.push('transaction not found on the mirror node within 60s');
    return;
  }
  step.notes.push(`mirror: transaction result ${tx.result}, consensus ${tx.consensus}`);
  step.mirrorVerified = tx.result === 'SUCCESS';
  if (!step.hashscan) step.hashscan = txLink(tx.consensus, step.transactionId);
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
  const agentKit = hederaOperations.isUsingAgentKit();
  console.log(`hedera-agent-kit available: ${agentKit}`);

  // a) Fungible token
  let tokenId: string | undefined;
  {
    const step: ProofStep = { operation: 'Create fungible token (APIX Proof / APIXP)', status: 'failed', mirrorVerified: false, notes: [] };
    try {
      const result = await hederaOperations.createToken({ name: 'APIX Proof', symbol: 'APIXP', decimals: 2, initialSupply: 100000 });
      if (!result.success) throw new Error(result.error ?? 'createToken returned success: false');
      step.notes.push(`created via ${result.details?.method ?? 'direct SDK'}`);
      if (!result.tokenId) {
        // Look the token up for the record only; later steps don't use it
        const created = await mirror<any>(
          `/transactions?account.id=${operator}&transactiontype=TOKENCREATION&order=desc&limit=1&timestamp=gte:${Date.parse(startedAt) / 1000}`,
          b => (b.transactions?.length ?? 0) > 0
        );
        const tx = created?.transactions?.[0];
        step.entityId = tx?.entity_id;
        step.transactionId = tx?.transaction_id;
        step.hashscan = tx ? `${HASHSCAN}/token/${tx.entity_id}` : undefined;
        throw new Error(
          'createToken reported success but returned no token ID' +
          (tx ? ` (the mirror node shows token ${tx.entity_id} created by ${tx.transaction_id}, result ${tx.result})` : '')
        );
      }
      tokenId = result.tokenId;
      step.entityId = tokenId;
      step.transactionId = result.transactionId;
      step.hashscan = `${HASHSCAN}/token/${tokenId}`;
      const token = await mirror<any>(`/tokens/${tokenId}`);
      if (token) {
        const treasuryOk = token.treasury_account_id === operator;
        step.notes.push(`mirror: name "${token.name}", symbol ${token.symbol}, decimals ${token.decimals}, total supply ${token.total_supply}, treasury ${token.treasury_account_id} (${treasuryOk ? 'operator, as expected' : 'NOT the operator'})`);
        step.mirrorVerified = token.name === 'APIX Proof' && token.symbol === 'APIXP' && treasuryOk;
      } else {
        step.notes.push('token not found on the mirror node within 60s');
      }
      if (step.transactionId) {
        const tx = await mirrorTransaction(step.transactionId);
        step.notes.push(tx ? `mirror: transaction result ${tx.result}` : 'transaction not found on the mirror node');
        if (tx?.result !== 'SUCCESS') step.mirrorVerified = false;
      } else {
        step.notes.push('no transaction ID returned');
      }
      step.status = 'ok';
    } catch (error) {
      step.error = masked(error);
    }
    record(step);
  }

  // b) Mint, then transfer to the demo recipient
  if (!SMOKE) {
    record({
      operation: 'Mint APIXP',
      status: 'unavailable',
      mirrorVerified: false,
      notes: ['hedera-operations has no mint method (only create, transfer, contract deploy/call, topic create/submit); not worked around'],
    });

    const step: ProofStep = { operation: `Transfer 10.00 APIXP to ${recipient}`, status: 'failed', mirrorVerified: false, notes: [] };
    try {
      if (!tokenId) throw new Error('skipped: createToken returned no token ID');
      if (!recipient) throw new Error('APIX_DEMO_RECIPIENT is not set');
      const result = await hederaOperations.transferToken({ tokenId, fromAccount: operator, toAccount: recipient, amount: 1000 });
      if (!result.success) throw new Error(result.error ?? 'transferToken returned success: false');
      step.transactionId = result.transactionId;
      step.entityId = tokenId;
      step.notes.push(`receipt status ${result.details?.receiptStatus}`);
      await verifyTransaction(step);
      const balances = await mirror<any>(`/tokens/${tokenId}/balances?account.id=${recipient}`, b => (b.balances?.[0]?.balance ?? 0) > 0);
      const balance = balances?.balances?.[0]?.balance;
      step.notes.push(`mirror: recipient balance ${balance ?? 'not found'} (smallest units; expected 1000)`);
      if (balance !== 1000) step.mirrorVerified = false;
      step.status = 'ok';
    } catch (error) {
      step.error = masked(error);
    }
    record(step);
  }

  // c) HCS topic and messages
  let topicId: string | undefined;
  {
    const step: ProofStep = { operation: 'Create HCS topic', status: 'failed', mirrorVerified: false, notes: [] };
    try {
      const result = await hederaOperations.createTopic({ memo: 'APIX testnet proof' });
      if (!result.success) throw new Error(result.error ?? 'createTopic returned success: false');
      topicId = result.tokenId;
      step.entityId = topicId;
      step.transactionId = result.transactionId;
      step.hashscan = `${HASHSCAN}/topic/${topicId}`;
      step.notes.push(`library explorerUrl: ${result.explorerUrl}`);
      const topic = await mirror<any>(`/topics/${topicId}`);
      step.notes.push(topic ? `mirror: topic memo "${topic.memo}"` : 'topic not found on the mirror node within 60s');
      await verifyTransaction(step);
      step.hashscan = `${HASHSCAN}/topic/${topicId}`;
      if (!topic) step.mirrorVerified = false;
      step.status = 'ok';
    } catch (error) {
      step.error = masked(error);
    }
    record(step);
  }

  const messages = SMOKE ? ['APIX nightly smoke'] : ['APIX testnet proof: message 1', 'APIX testnet proof: message 2'];
  for (const [index, message] of messages.entries()) {
    const step: ProofStep = { operation: `Submit topic message ${index + 1}`, status: 'failed', mirrorVerified: false, notes: [] };
    try {
      if (!topicId) throw new Error('skipped: no topic was created');
      const result = await hederaOperations.submitTopicMessage({ topicId, message });
      if (!result.success) throw new Error(result.error ?? 'submitTopicMessage returned success: false');
      step.entityId = topicId;
      step.transactionId = result.transactionId;
      await verifyTransaction(step);
      // Found by consensus timestamp, so an earlier failed message doesn't shift the lookup
      const tx = await mirrorTransaction(step.transactionId!);
      const found = tx ? await mirror<any>(`/topics/${topicId}/messages?timestamp=${tx.consensus}`, b => (b.messages?.length ?? 0) > 0) : null;
      const stored = found?.messages?.[0];
      const content = stored ? Buffer.from(stored.message, 'base64').toString('utf8') : undefined;
      step.notes.push(`mirror: ${stored ? `sequence ${stored.sequence_number} = ${JSON.stringify(content)}` : 'message not found'}`);
      if (content !== message) step.mirrorVerified = false;
      step.status = 'ok';
    } catch (error) {
      step.error = masked(error);
    }
    record(step);
  }

  // d) Real contract: compile, deploy, set, get
  if (!SMOKE) {
    let contractId: string | undefined;
    let compiled: ReturnType<typeof compileStringStore> | undefined;
    const deploy: ProofStep = { operation: 'Deploy StringStore contract (solc)', status: 'failed', mirrorVerified: false, notes: [] };
    try {
      compiled = compileStringStore();
      deploy.notes.push(`compiled with solc ${compiled.compiler}, ${compiled.bytecode.length / 2} bytes`);
      const result = await hederaOperations.deploySmartContract({ bytecode: compiled.bytecode, gas: 400000 });
      if (!result.success) throw new Error(result.error ?? 'deploySmartContract returned success: false');
      contractId = result.tokenId;
      deploy.entityId = contractId;
      deploy.transactionId = result.transactionId;
      deploy.notes.push(`bytecode file ${result.details?.fileId}; library explorerUrl: ${result.explorerUrl}`);
      const contract = await mirror<any>(`/contracts/${contractId}`);
      deploy.notes.push(contract ? `mirror: contract ${contract.contract_id}, evm ${contract.evm_address}, file ${contract.file_id}` : 'contract not found on the mirror node within 60s');
      await verifyTransaction(deploy);
      deploy.hashscan = `${HASHSCAN}/contract/${contractId}`;
      if (!contract) deploy.mirrorVerified = false;
      deploy.status = 'ok';
    } catch (error) {
      deploy.error = masked(error);
    }
    record(deploy);

    const value = 'hello from APIX';
    const set: ProofStep = { operation: `Call set("${value}")`, status: 'failed', mirrorVerified: false, notes: [] };
    try {
      if (!contractId) throw new Error('skipped: no contract was deployed');
      const result = await hederaOperations.callSmartContract({ contractId, functionName: 'set', parameters: [value], gas: 100000 });
      set.entityId = contractId;
      set.transactionId = result.transactionId;
      if (!result.success) throw new Error(result.error ?? 'callSmartContract returned success: false');
      set.notes.push(`receipt status ${result.details?.receiptStatus}`);
      await verifyTransaction(set);
      set.status = 'ok';
    } catch (error) {
      set.error = masked(error);
      set.notes.push('callSmartContract ignores functionName and parameters: it sends a ContractExecute with no function data');
      // The failed receipt names the transaction; record what the mirror node saw
      const failedTx = set.error.match(/transaction (\d+\.\d+\.\d+@\d+\.\d+)/)?.[1];
      if (failedTx && !set.transactionId) {
        set.transactionId = failedTx;
        const tx = await mirrorTransaction(failedTx).catch(() => null);
        set.hashscan = txLink(tx?.consensus, failedTx);
        set.notes.push(tx ? `mirror: transaction result ${tx.result}` : 'transaction not found on the mirror node');
      }
    }
    record(set);

    const get: ProofStep = { operation: 'Call get() and check the round trip', status: 'unavailable', mirrorVerified: false, notes: [] };
    get.notes.push('hedera-operations has no read/query method for contracts; not worked around');
    try {
      if (contractId && compiled) {
        const contract = await mirror<any>(`/contracts/${contractId}`);
        const response = await fetch(`${MIRROR}/contracts/call`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ to: contract.evm_address, data: `0x${compiled.selectors['get()']}`, block: 'latest' }),
        });
        const body: any = await response.json();
        const stored = response.ok ? decodeAbiString(body.result ?? '') : undefined;
        get.entityId = contractId;
        get.notes.push(`independent check via mirror node eth_call: get() returns ${stored === undefined ? `HTTP ${response.status}` : JSON.stringify(stored)} (expected ${JSON.stringify(value)})`);
        get.mirrorVerified = stored === value;
      }
    } catch (error) {
      get.notes.push(`mirror eth_call failed: ${masked(error)}`);
    }
    record(get);
  }

  hederaOperations.close();

  const sdkVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'node_modules', '@hashgraph', 'sdk', 'package.json'), 'utf8')).version;
  const report = { startedAt, finishedAt: new Date().toISOString(), network, operator, recipient, agentKit, sdkVersion, smoke: SMOKE, steps };
  if (!SMOKE) {
    const out = path.join(__dirname, '..', 'docs', 'testnet-proof.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    console.log(`Results written to ${path.relative(process.cwd(), out)}`);
  }

  const failed = steps.filter(step => step.status === 'failed');
  console.log(`\n${steps.length} steps: ${steps.filter(s => s.status === 'ok').length} ok, ${failed.length} failed, ${steps.filter(s => s.status === 'unavailable').length} unavailable`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error(`Proof aborted: ${masked(error)}`);
  process.exit(1);
});
