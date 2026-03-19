# FibX Telegram Bot

AI-powered Telegram bot for [FibX](https://github.com/ahmetenesdur/fibx) DeFi on EVM chains. Users bring their own AI model — OpenAI, Claude, or Gemini — and their own API key. No shared keys, no centralized billing.

## Features

- **Swap** — DEX-aggregated trading via Fibrous with optimal routing
- **Transfer** — Send native tokens and ERC-20s across supported chains
- **Lend** — Supply, borrow, repay, withdraw on Aave V3 (Base)
- **Markets** — Live Aave V3 market data with APY, supply, borrow, and LTV
- **Portfolio** — Cross-chain balances with USD valuations
- **Multi-chain** — Base, Citrea, HyperEVM, Monad

## Quick Start

```bash
git clone https://github.com/ahmetenesdur/fibx-telegram-bot.git
cd fibx-telegram-bot
pnpm install

cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN, BOT_ENCRYPTION_SECRET, FIBX_SERVER_URL

pnpm dev
```

## Environment Variables

| Variable                | Required | Description                                                     |
| ----------------------- | -------- | --------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`    | Yes      | Bot token from [@BotFather](https://t.me/BotFather)             |
| `BOT_ENCRYPTION_SECRET` | Yes      | 64-char hex string — `openssl rand -hex 32`                     |
| `FIBX_SERVER_URL`       | Yes      | FibX server URL for authentication                              |
| `FIBX_MCP_COMMAND`      | No       | MCP command (default: `npx`)                                    |
| `FIBX_MCP_ARGS`         | No       | MCP args, comma-separated (default: `-y,fibx@latest,mcp-start`) |
| `LOG_LEVEL`             | No       | `debug`, `info`, `warn`, `error` (default: `info`)              |
| `MAX_HISTORY`           | No       | Chat history length per user (default: `20`)                    |
| `RATE_LIMIT_PER_MINUTE` | No       | Max messages per minute per user (default: `30`)                |
| `MCP_IDLE_TIMEOUT_MS`   | No       | MCP process idle timeout in ms (default: `300000`)              |
| `WEBHOOK_DOMAIN`        | No       | Webhook domain for production deployment                        |
| `PORT`                  | No       | HTTP server port (default: `8080`)                              |

## Commands

| Command      | Description                               |
| ------------ | ----------------------------------------- |
| `/start`     | Welcome message                           |
| `/setup`     | Configure AI provider, model, and API key |
| `/auth`      | Connect FibX wallet via email OTP         |
| `/model`     | Switch AI model within current provider   |
| `/status`    | View current session and configuration    |
| `/clear`     | Reset chat history                        |
| `/deletekey` | Remove API key and session data           |
| `/about`     | About FibX                                |
| `/help`      | Show available commands                   |

## Deployment

```bash
docker build -t fibx-telegram-bot .
docker run -d --env-file .env fibx-telegram-bot
```

For Railway or similar platforms, set the environment variables in the dashboard and deploy from the repository.

## Requirements

- Node.js 18+
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- API key from OpenAI, Anthropic, or Google

## License

MIT
