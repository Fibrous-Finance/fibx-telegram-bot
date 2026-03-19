import { type BotContext } from "../middleware/session.js";
import { MODEL_OPTIONS, PROVIDER_LABELS } from "../../session/types.js";
import { truncateAddress } from "../../lib/format.js";
import { type McpProcessPool } from "../../mcp/pool.js";

export function createStatusCommand(mcpPool: McpProcessPool) {
	return async function statusCommand(ctx: BotContext): Promise<void> {
		const session = ctx.userSession;

		if (!session) {
			await ctx.reply(
				"*Status*\n\n" +
					"AI Model: Not configured\n" +
					"Wallet: Not connected\n\n" +
					"Use /setup to get started.",
				{ parse_mode: "Markdown" }
			);
			return;
		}

		const walletLine = session.fibxAddr
			? `\`${truncateAddress(session.fibxAddr)}\``
			: "Not connected (/auth)";

		const modelLabel =
			(session.provider && session.model
				? MODEL_OPTIONS[session.provider]?.find((m) => m.id === session.model)?.label
				: null) ?? session.model ?? "—";

		await ctx.reply(
			"*Status*\n\n" +
				`Provider: *${session.provider ? PROVIDER_LABELS[session.provider] : "Not configured"}*\n` +
				`Model: \`${modelLabel}\`\n` +
				`Wallet: ${walletLine}\n` +
				`History: ${session.history?.length ?? 0} messages\n` +
				`Active MCP: ${mcpPool.size} processes`,
			{ parse_mode: "Markdown" }
		);
	};
}
