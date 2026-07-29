import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { createHash } from "node:crypto";
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

	const writeHealth = (res: ServerResponse) => {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ status: "ok", mcpProcesses: mcpPool.size }));
	};

	// ── Launch ──
	let health: ReturnType<typeof createServer> | null = null;

	if (config.webhookDomain) {
		// Never put the bot token in the URL — it would end up in reverse proxy,
		// CDN and access logs. secretPathComponent() is a sha3-256 digest of the
		// token: stable across restarts, and it gives nothing away.
		const webhookPath = config.webhookSecretPath ?? `/webhook/${bot.secretPathComponent()}`;

		// Telegram echoes this back in X-Telegram-Bot-Api-Secret-Token, so anyone
		// who discovers the URL still cannot inject forged updates.
		const secretToken = createHash("sha256")
			.update(`${config.telegramBotToken}:${config.encryptionSecret}`)
			.digest("hex");

		await bot.launch({
			webhook: {
				domain: config.webhookDomain,
				port: config.port,
				hookPath: webhookPath,
				secretToken,
				// Telegraf only serves the hook path; everything else lands here.
				// Without this, container health probes get no answer in webhook mode.
				cb: (req, res) => {
					if (req.url === "/health") {
						writeHealth(res);
						return;
					}
					res.writeHead(404, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "Not found" }));
				},
			},
		});
		logger.info("Bot started (webhook mode)", {
			domain: config.webhookDomain,
			port: config.port,
			path: webhookPath,
		});
	} else {
		await bot.launch();
		logger.info("Bot started (polling mode)");

		health = createServer((_req, res) => writeHealth(res));
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
