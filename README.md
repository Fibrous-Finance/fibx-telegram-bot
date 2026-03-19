# fibx Telegram Bot

AI-powered Telegram bot for DeFi on EVM chains (Base, Citrea, HyperEVM, Monad), powered by the fibx CLI and MCP server.

## Features

- 🤖 **Multi-provider AI** — OpenAI, Claude, Gemini (bring your own key)
- 🔄 **Token swaps** via Fibrous aggregator with optimal routing
- 💸 **Token transfers** — native and ERC-20
- 🏦 **Aave V3** — supply, borrow, repay, withdraw (Base)
- 📊 **Portfolio** — cross-chain USD valuations
- 🔐 **Secure sessions** — AES-256-GCM encrypted API keys
- ⚡ **Per-user isolation** — each user gets an isolated MCP process

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Telegram bot token (from [@BotFather](https://t.me/BotFather))

### Setup

```bash
# Clone and install
cd fibx-telegram-bot
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Run in development
pnpm dev

# Build for production
pnpm build
pnpm start
```

### Environment Variables

| Variable                | Required | Description                                        |
| ----------------------- | -------- | -------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`    | ✅       | Bot token from @BotFather                          |
| `BOT_ENCRYPTION_SECRET` | ✅       | 64-char hex string (`openssl rand -hex 32`)        |
| `FIBX_SERVER_URL`       | ✅       | fibx server URL for auth                           |
| `FIBX_MCP_COMMAND`      | ❌       | MCP command (default: `npx`)                       |
| `FIBX_MCP_ARGS`         | ❌       | MCP args (default: `-y,fibx@latest,mcp-start`)     |
| `LOG_LEVEL`             | ❌       | `debug`, `info`, `warn`, `error` (default: `info`) |
| `MAX_HISTORY`           | ❌       | Chat history length (default: `20`)                |
| `RATE_LIMIT_PER_MINUTE` | ❌       | Messages per minute (default: `30`)                |
| `MCP_IDLE_TIMEOUT_MS`   | ❌       | MCP idle timeout (default: `300000`)               |
| `WEBHOOK_DOMAIN`        | ❌       | Webhook domain for production                      |
| `PORT`                  | ❌       | Server port (default: `8080`)                      |

## Commands

| Command      | Description                     |
| ------------ | ------------------------------- |
| `/start`     | Welcome message                 |
| `/setup`     | Configure AI provider and model |
| `/auth`      | Connect fibx wallet             |
| `/model`     | Switch AI model                 |
| `/status`    | View current configuration      |
| `/clear`     | Reset chat history              |
| `/deletekey` | Remove API key and data         |
| `/about`     | About FibX                      |
| `/help`      | Show help                       |

## Docker

```bash
docker build -t fibx-telegram-bot .
docker run -d --env-file .env fibx-telegram-bot
```

## Architecture

```
src/
├── index.ts           # Entry point
├── lib/               # Config, logger, format utilities
├── session/           # SQLite + AES-256-GCM encryption
├── mcp/               # Per-user MCP process pool
├── ai/                # Multi-provider AI router
├── auth/              # fibx-server OTP bridge
└── bot/               # Telegraf bot, commands, handlers
```
