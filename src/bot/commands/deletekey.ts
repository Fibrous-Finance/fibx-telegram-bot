import { type BotContext } from "../middleware/session.js";
import { type McpProcessPool } from "../../mcp/pool.js";

export function createDeleteKeyCommand(mcpPool: McpProcessPool) {
	return async function deleteKeyCommand(ctx: BotContext): Promise<void> {
		const userId = ctx.from!.id.toString();
		ctx.store.delete(userId);
		await mcpPool.kill(userId);
		await ctx.reply(
			"*API key deleted*\n\n" +
				"Your encrypted key has been removed from storage.\n" +
				"Use /setup to configure a new provider.",
			{ parse_mode: "Markdown" }
		);
	};
}
