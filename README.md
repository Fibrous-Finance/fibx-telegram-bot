# FibX Telegram Bot

AI-powered Telegram bot for [FibX](https://github.com/Fibrous-Finance/fibx) DeFi on EVM chains. Users bring their own AI model — OpenAI, Claude, or Gemini — and their own API key. No shared keys, no centralized billing.

## Features

- **Quote** — Price quotes without login — check rates instantly
- **Swap** — DEX-aggregated trading via Fibrous with optimal routing
- **Transfer** — Send native tokens and ERC-20s across supported chains
- **Lend** — Supply, borrow, repay, withdraw on Aave V3 (Base)
- **Markets** — Live Aave V3 market data with APY, supply, borrow, and LTV
- **Portfolio** — Cross-chain balances with USD valuations and DeFi positions
- **Price alerts** — `/alert ETH above 4000`, no login or AI key required
- **Multi-chain** — Base, Citrea, HyperEVM, Monad
- **Simulation** — `simulate=true` for fee estimation before execution
- **Multi-Provider** — OpenAI (GPT-5.4), Claude (4.6), Gemini (3.1)

## Supported Models

| Provider | Models                                               | Default      |
| -------- | ---------------------------------------------------- | ------------ |
| OpenAI   | GPT-5.4 Nano, GPT-5.4 Mini, GPT-5.4                  | GPT-5.4 Mini |
| Claude   | Haiku 4.5, Sonnet 4.6, Opus 4.6                      | Sonnet 4.6   |
| Gemini   | 3.1 Flash-Lite, 3 Flash, 2.5 Flash, 2.5 Pro, 3.1 Pro | 2.5 Flash    |

## Quick Start

```bash
git clone https://github.com/Fibrous-Finance/fibx-telegram-bot.git
cd fibx-telegram-bot
pnpm install

cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN, BOT_ENCRYPTION_SECRET, FIBX_SERVER_URL

pnpm dev
```

## Environment Variables

| Variable                 | Required | Description                                                     |
| ------------------------ | -------- | --------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`     | Yes      | Bot token from [@BotFather](https://t.me/BotFather)             |
| `BOT_ENCRYPTION_SECRET`  | Yes      | 64-char hex string — `openssl rand -hex 32`                     |
| `FIBX_SERVER_URL`        | Yes      | FibX server URL for authentication                              |
| `FIBX_MCP_COMMAND`       | No       | MCP command (default: `npx`)                                    |
| `FIBX_MCP_ARGS`          | No       | MCP args, comma-separated (default: `-y,fibx@latest,mcp-start`) |
| `LOG_LEVEL`              | No       | `debug`, `info`, `warn`, `error` (default: `info`)              |
| `MAX_HISTORY`            | No       | Chat history length per user (default: `20`)                    |
| `RATE_LIMIT_PER_MINUTE`  | No       | Max messages per minute per user (default: `30`)                |
| `MCP_IDLE_TIMEOUT_MS`    | No       | MCP process idle timeout in ms (default: `300000`)              |
| `WEBHOOK_DOMAIN`         | No       | Webhook domain for production deployment                        |
| `WEBHOOK_SECRET_PATH`    | No       | Custom webhook path (default: a hash of the bot token)          |
| `ALERT_POLL_INTERVAL_MS` | No       | Price alert poll interval (default: `60000`, min `10000`)       |
| `PORT`                   | No       | HTTP server port (default: `8080`)                              |

## Commands

| Command      | Description                                      |
| ------------ | ------------------------------------------------ |
| `/start`     | Welcome message                                  |
| `/setup`     | Configure AI provider, model, and API key        |
| `/auth`      | Log in to FibX account via email OTP             |
| `/model`     | Switch AI model within current provider          |
| `/status`    | View current session and configuration           |
| `/clear`     | Reset chat history                               |
| `/deletekey` | Remove credentials and session data; keep alerts |
| `/alert`     | One-shot price alerts (`/alert ETH above 4000`)  |
| `/about`     | About FibX                                       |
| `/help`      | Show available commands                          |

### Price alerts

`/alert <token> above|below <price> [chain]` creates a one-shot alert (max 10
per user, chains: base, citrea, hyperevm, monad). Prices come from the public
Fibrous token feed, polled every `ALERT_POLL_INTERVAL_MS` (default 60s), and
each alert notifies exactly once before being removed. `/alert list` and
`/alert delete <id>` manage existing alerts. Alerts work without an AI key or
FibX login — only the chat is needed.

## Architecture

```
fibx-telegram-bot/
├── src/
│   ├── index.ts              # Entry point: config, store, pool, launch
│   ├── ai/
│   │   ├── router.ts         # generateText loop with MCP tools + error taxonomy
│   │   ├── providers.ts      # OpenAI / Anthropic / Google model factory
│   │   └── system-prompt.ts  # System prompt with 13 behavioral rules
│   ├── auth/
│   │   └── fibx-auth.ts      # fibx-server OTP login + CLI session file
│   ├── bot/
│   │   ├── bot.ts            # Telegraf bot setup and text routing
│   │   ├── commands/         # Command handlers
│   │   ├── handlers/         # Message and callback-query handlers
│   │   └── middleware/       # Session, rate-limit, per-user queue
│   ├── mcp/
│   │   ├── client.ts         # Stdio MCP client with per-user virtual HOME
│   │   └── pool.ts           # Per-user MCP process pool with stale detection
│   ├── session/
│   │   ├── store.ts          # SQLite session storage (WAL mode)
│   │   ├── types.ts          # Provider, model definitions, MODEL_DEFAULTS
│   │   └── crypto.ts         # AES-256-GCM API key encryption
│   └── lib/
│       ├── config.ts         # Zod-validated environment config
│       ├── logger.ts         # Structured logging
│       └── format.ts         # Telegram markdown sanitizing and chunking
```

### MCP Process Pool

Each Telegram user gets a dedicated MCP child process and bot-managed virtual
HOME/config path. The pool manages lifecycle:

- **Lazy initialization** — process spawns on first message
- **Health checks** — 5-second timeout with stale client detection
- **Max retries** — 2 reconnection attempts before failing
- **Idle cleanup** — processes are killed after `MCP_IDLE_TIMEOUT_MS` (default: 5 min)

## Security

- **Bring your own key.** There is no shared LLM key. Each user's API key is
  encrypted at rest with AES-256-GCM, and the message containing it is deleted
  from the chat immediately after it is stored. `/deletekey` removes the saved
  AI-provider configuration and encrypted API key, FibX login/session files,
  pending setup/login state, conversation history, and that user's bot-managed
  FibX config/cache directory. Price alerts stay active until they fire or are
  removed separately with `/alert delete <id>`.
- **Separated paths and processes per user.** Every user gets a dedicated MCP
  child process with a distinct virtual HOME and redirected XDG paths. These are
  application-level boundaries: the bot and its MCP children run under the same
  OS account, not separate OS users or containers. The FibX session file is
  written `0600`, which blocks access by other unprivileged OS accounts but not
  the bot account itself (or a privileged host administrator).
- **Limits live below the model.** Wallet spending caps are enforced by the
  Privy signing policy configured in
  [fibx-server](https://github.com/Fibrous-Finance/fibx-server#wallet-policy-privy-signing-layer),
  not by the system prompt — a jailbroken prompt cannot raise them.
- **Confirmation before value moves.** The agent must ask for an explicit
  confirmation before any transactional tool call.

In webhook mode the bot uses a hashed URL path (never the bot token) and
validates Telegram's `secret_token` header, so a leaked URL alone cannot be
used to inject updates.

## Deployment

```bash
docker build -t fibx-telegram-bot .
docker run -d --env-file .env fibx-telegram-bot
```

For Railway or similar platforms, set the environment variables in the dashboard and deploy from the repository.

Set `WEBHOOK_DOMAIN` to run in webhook mode; otherwise the bot long-polls. Both
modes serve `GET /health` on `PORT` for container probes.

## Requirements

- Node.js 18+
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- API key from OpenAI, Anthropic, or Google

## License

MIT
