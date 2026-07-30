import { type BotContext } from "../middleware/session.js";
import { type McpProcessPool } from "../../mcp/pool.js";
import { logger } from "../../lib/logger.js";

export function createDeleteKeyCommand(mcpPool: McpProcessPool) {
	return async function deleteKeyCommand(ctx: BotContext): Promise<void> {
		const userId = ctx.from!.id.toString();
		let homeCleanupError: unknown;
		try {
			await mcpPool.deleteUserHome(userId);
		} catch (error) {
			homeCleanupError = error;
			logger.error("Failed to delete user MCP HOME", {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		ctx.store.delete(userId);

		if (homeCleanupError) {
			await ctx.reply(
				"*Credential deletion incomplete*\n\n" +
					"Your saved AI-provider configuration and encrypted API key, pending setup/login " +
					"state, and conversation history were removed from the bot database. The FibX " +
					"login/config directory could not be confirmed deleted and may still be present.\n\n" +
					"Price alerts are retained. Please try /deletekey again or contact the bot operator.",
				{ parse_mode: "Markdown" }
			);
			return;
		}

		await ctx.reply(
			"*Credentials and session deleted*\n\n" +
				"Your saved AI-provider configuration and encrypted API key, FibX login session, " +
				"pending setup/login state, conversation history, and bot-managed FibX config/cache " +
				"have been removed.\n\n" +
				"Price alerts are retained. Use `/alert list` and `/alert delete <id>` to remove them.\n\n" +
				"Use /setup to configure a new provider.",
			{ parse_mode: "Markdown" }
		);
	};
}
