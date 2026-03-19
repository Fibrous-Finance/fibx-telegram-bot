import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { type BotContext } from "./middleware/session.js";
import { sessionMiddleware } from "./middleware/session.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { type SessionStore } from "../session/store.js";
import { type McpProcessPool } from "../mcp/pool.js";
import { type Config } from "../lib/config.js";
import { startCommand } from "./commands/start.js";
import { createSetupHandlers } from "./commands/setup.js";
import { createAuthHandlers } from "./commands/auth.js";
import { helpCommand } from "./commands/help.js";
import { aboutCommand } from "./commands/about.js";
import { modelCommand } from "./commands/model.js";
import { createStatusCommand } from "./commands/status.js";
import { clearCommand } from "./commands/clear.js";
import { createDeleteKeyCommand } from "./commands/deletekey.js";
import { createMessageHandler } from "./handlers/message.js";
import { createCallbackHandler } from "./handlers/callback.js";
import { logger } from "../lib/logger.js";

export function createBot(
	config: Config,
	store: SessionStore,
	mcpPool: McpProcessPool
): Telegraf<BotContext> {
	const bot = new Telegraf<BotContext>(config.telegramBotToken);

	// ── Middleware ──
	bot.use(sessionMiddleware(store));
	bot.use(rateLimitMiddleware(config.rateLimitPerMinute));

	// ── Commands ──
	const setupHandlers = createSetupHandlers(config);
	const authHandlers = createAuthHandlers(config, mcpPool);

	bot.command("start", startCommand);
	bot.command("setup", setupHandlers.setupCommand);
	bot.command("auth", authHandlers.authCommand);
	bot.command("help", helpCommand);
	bot.command("about", aboutCommand);
	bot.command("model", modelCommand);
	bot.command("status", createStatusCommand(mcpPool));
	bot.command("clear", clearCommand);
	bot.command("deletekey", createDeleteKeyCommand(mcpPool));

	// ── Callback queries (inline keyboard) ──
	const callbackHandler = createCallbackHandler(config, mcpPool);
	bot.on("callback_query", callbackHandler);

	// ── Text messages ──
	const messageHandler = createMessageHandler(config, mcpPool);

	bot.on(message("text"), async (ctx) => {
		const userId = ctx.from.id.toString();
		const text = ctx.message.text;

		// Check if this is part of a multi-step flow
		const authState = ctx.store.getAuthState(userId);

		if (authState?.step === "setup:api_key") {
			await setupHandlers.handleApiKey(ctx, text);
			return;
		}

		if (authState?.step === "auth:email") {
			await authHandlers.handleEmail(ctx, text);
			return;
		}

		if (authState?.step === "auth:otp") {
			await authHandlers.handleOtp(ctx, text);
			return;
		}

		// Regular message → AI router
		await messageHandler(ctx);
	});

	// ── Error handler ──
	bot.catch((err, ctx) => {
		logger.error("Unhandled bot error", {
			error: err instanceof Error ? err.message : String(err),
			updateType: ctx.updateType,
		});
	});

	return bot;
}
