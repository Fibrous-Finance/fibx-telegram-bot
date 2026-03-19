import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { loadConfig } from "./lib/config.js";
import { setLogLevel, logger } from "./lib/logger.js";
import { SessionStore } from "./session/store.js";
import { McpProcessPool } from "./mcp/pool.js";
import { createBot } from "./bot/bot.js";

async function main(): Promise<void> {
	const config = loadConfig();
	setLogLevel(config.logLevel);

	logger.info("Starting fibx Telegram bot", {
		logLevel: config.logLevel,
		mcpCommand: config.mcpCommand,
	});

	// ── Session store ──
	const dataDir = join(process.cwd(), ".data");
	mkdirSync(dataDir, { recursive: true });
	const store = new SessionStore(join(dataDir, "sessions.db"));

	// ── MCP process pool ──
	const mcpPool = new McpProcessPool(
		config.mcpCommand,
		config.mcpArgs,
		config.mcpIdleTimeoutMs,
		dataDir
	);

	// ── Bot ──
	const bot = createBot(config, store, mcpPool);

	// ── Launch ──
	if (config.webhookDomain) {
		const webhookPath = config.webhookSecretPath ?? `/webhook/${config.telegramBotToken}`;
		await bot.launch({
			webhook: {
				domain: config.webhookDomain,
				port: config.port,
				hookPath: webhookPath,
			},
		});
		logger.info("Bot started (webhook mode)", {
			domain: config.webhookDomain,
			port: config.port,
		});
	} else {
		await bot.launch();
		logger.info("Bot started (polling mode)");
	}

	// ── Health check server (only in polling mode — webhook uses its own HTTP server) ──
	let health: ReturnType<typeof createServer> | null = null;
	if (!config.webhookDomain) {
		health = createServer((_req, res) => {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ status: "ok", mcpProcesses: mcpPool.size }));
		});
		health.listen(config.port, () => {
			logger.info("Health check server listening", { port: config.port });
		});
	}

	// ── Graceful shutdown ──
	let isShuttingDown = false;

	const shutdown = async (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;

		logger.info("Shutting down", { signal });
		bot.stop(signal);
		await mcpPool.shutdown();
		store.close();
		health?.close();
		process.exit(0);
	};

	process.once("SIGINT", () => shutdown("SIGINT"));
	process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
