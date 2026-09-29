# Commands

`apix <command> --help` lists every option. This page covers what each
command does and what it needs. APIX reads `.env` from the current
directory.

## No keys needed

| Command | What it does |
|---|---|
| `apix analyze` | Detects the framework, language, layout and existing Hedera code, then suggests integrations. `--directory <path>` analyses another folder. It ends with an interactive "what next?" menu when run in a terminal. |
| `apix add <integration>` | Writes a Hedera integration into the project and installs its packages. Integrations: `hts`, `wallet`, `smart-contract` (alias `contract`), `consensus` (alias `hcs`). For `hts`, `--name` and `--symbol` name the token that `--create-token` creates (the generated code doesn't use them). `--force` overwrites differing files. See [integrations.md](integrations.md). |
| `apix init` | Saves APIX's project settings to `.apix/config.json`. `--force` re-creates them. |
| `apix status` | Shows which Hedera integrations the project already has. |
| `apix health` | Checks the project, dependencies, Hedera SDK, credentials (format only), AI key and WalletConnect project ID. `--quick` skips the detailed project checks, `--fix` shows fix suggestions, and `--strict` exits 1 unless every area is ok. |
| `apix logs` | Shows recent APIX log entries (`--count`, `--level`, `--command` filter them). Secrets are masked. |
| `apix last-error` | Shows the last logged error. |
| `apix debug-info` | Shows the log directory and log files. |
| `apix --version`, `apix --help` | Version and help. |

`add` refuses, and leaves the project unchanged, when:
- the framework isn't supported (see the
  [support matrix](../README.md#support-matrix));
- it would overwrite a file that differs from what APIX generates (re-run
  with `--force` to overwrite);
- the integration isn't available (`account`).

## Needs Hedera credentials

`validate` only checks; the others submit real transactions and cost HBAR. They need `HEDERA_ACCOUNT_ID`
and `HEDERA_PRIVATE_KEY` (and optionally `HEDERA_NETWORK`, which defaults to
`testnet`).

| Command | What it does |
|---|---|
| `apix validate` | Checks your Hedera configuration locally: network (from `HEDERA_NETWORK`), account and client. It makes no network call and costs nothing. |
| `apix create-token` | Creates a fungible token with the operator as treasury. `--name`, `--symbol`, `--decimals`, `--supply` (initial supply in the smallest unit), `--max-supply` (caps the supply; without it the supply is infinite), and `--admin-key`, `--supply-key`, `--freeze-key`, `--wipe-key` (each sets that key to the operator key). It prints the token ID, transaction ID and HashScan links. |
| `apix add hts --create-token --name <name> --symbol <SYMBOL>` | After writing the HTS files, also creates that token (1,000,000 tokens at 8 decimals, with the operator as admin and supply key, so the generated mint route works). `--name` and `--symbol` are required. Without `--create-token`, `add hts --name ... --symbol ...` offers this interactively, only when credentials are set and a terminal is attached. |

On mainnet (`HEDERA_NETWORK=mainnet`), both ask
"This will spend real HBAR on MAINNET. Continue? (y/N)" before doing
anything. `--yes` skips the question. With no terminal and no `--yes`, they
refuse and exit 1.

## Needs an AI key

These need `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. Without one, they exit 1
with, for example:

```
❌ `apix explain` needs an AI key. Set ANTHROPIC_API_KEY (or OPENAI_API_KEY) in your .env.
```

| Command | What it does |
|---|---|
| `apix explain "<concept>"` | Explains a Hedera concept. `--industry <industry>` tailors the explanation. |
| `apix compare "<approaches>"` | Compares Hedera approaches for a use case. `--industry <industry>` adds context. |
| `apix recommend` | Recommends Hedera services and the `apix add` command to start with. `--industry <industry>` adds context. |
| `apix confidence "<requirement>"` | Estimates how feasible a requirement is with APIX and Hedera. `--detailed` shows the breakdown by area. |
| `apix debug "<issue>"` | Diagnoses an issue and suggests what to try. `--context <text>` adds background. It never retries or changes anything. |
| `apix generate <integration>` | Classifies your requirement with the AI, then writes the same files as `apix add <integration>`. `--industry <industry>` adds context; `--force` overwrites differing files, as with `add`. |
| `apix chat` | An interactive conversation about your Hedera project. `--industry` and `--context` set the starting context, `--session-file <file>` resumes a saved session, and `--clean` uses plain terminal output. |

Provider and model selection are described in the
[README](../README.md#ai-features). An API failure (rejected key, rate
limit, unknown model) exits 1 with the provider's message. There are no
canned replies.

### Experimental: compose

`compose` is hidden from `--help` unless `APIX_EXPERIMENTAL=1` is set, and
it refuses to run without `--experimental`:

```bash
apix compose --experimental --requirements "Track supply chain events on HCS"
```

`--industry` and `--constraints` add context. It needs an AI key. It lists the
files it composed and any
`TODO: Implement` stubs they contain. It does not write them to disk.

## Global options

`--quiet` (errors only), `--verbose`, `--debug` and `--trace` (stack traces in
the log) set how much APIX prints and logs; put them before the command,
e.g. `apix --debug add hts`.
