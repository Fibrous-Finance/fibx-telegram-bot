import { type BotContext } from "../middleware/session.js";
import { type McpProcessPool } from "../../mcp/pool.js";
import { type Config } from "../../lib/config.js";
import { createSetupHandlers } from "../commands/setup.js";
import { createAuthHandlers } from "../commands/auth.js";
import { handleModelSwitch } from "../commands/model.js";
import { helpCommand } from "../commands/help.js";
import { aboutCommand } from "../commands/about.js";
import { type Provider } from "../../session/types.js";
import { logger } from "../../lib/logger.js";

export function createCallbackHandler(config: Config, mcpPool: McpProcessPool) {
	const setupHandlers = createSetupHandlers(config);
	const authHandlers = createAuthHandlers(config, mcpPool);

	return async function handleCallback(ctx: BotContext): Promise<void> {
		const data =
			ctx.callbackQuery && "data" in ctx.callbackQuery ? ctx.callbackQuery.data : null;
		if (!data) return;

		await ctx.answerCbQuery();

		try {
			// Setup flow
			if (data.startsWith("setup:provider:")) {
				const provider = data.replace("setup:provider:", "") as Provider;
				await setupHandlers.handleProviderSelect(ctx, provider);
				return;
			}

			if (data.startsWith("setup:model:")) {
				const rest = data.slice("setup:model:".length); // e.g. "openai:gpt-4.1"
				const sepIdx = rest.indexOf(":");
				const provider = rest.slice(0, sepIdx) as Provider;
				const modelId = rest.slice(sepIdx + 1);
				await setupHandlers.handleModelSelect(ctx, provider, modelId);
				return;
			}

			if (data === "setup") {
				await setupHandlers.setupCommand(ctx);
				return;
			}

			// Auth flow
			if (data === "auth" || data === "auth:start") {
				await authHandlers.promptEmail(ctx);
				return;
			}

			if (data === "auth:cancel") {
				await ctx.editMessageText("Authentication cancelled.");
				return;
			}

			// Model switch
			if (data.startsWith("model:switch:")) {
				const rest = data.slice("model:switch:".length); // e.g. "openai:gpt-4.1"
				const sepIdx = rest.indexOf(":");
				const provider = rest.slice(0, sepIdx) as Provider;
				const modelId = rest.slice(sepIdx + 1);
				await handleModelSwitch(ctx, provider, modelId);
				return;
			}

			// Static commands
			if (data === "help") {
				await helpCommand(ctx);
				return;
			}

			if (data === "about") {
				await aboutCommand(ctx);
				return;
			}

			logger.warn("Unknown callback data", { data });
		} catch (error) {
			logger.error("Callback handler error", { data, error: String(error) });
			await ctx.reply("Something went wrong. Please try again.");
		}
	};
}
