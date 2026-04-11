import { type BotContext } from "../middleware/session.js";
import { type McpProcessPool } from "../../mcp/pool.js";
import { type Config } from "../../lib/config.js";
import { MessageQueue } from "../middleware/queue.js";
import { decrypt } from "../../session/crypto.js";
import { routeMessage } from "../../ai/router.js";
import { sanitizeForTelegram, chunkMessage } from "../../lib/format.js";
import { logger } from "../../lib/logger.js";

export function createMessageHandler(config: Config, mcpPool: McpProcessPool) {
	const queue = new MessageQueue();

	return async function handleMessage(ctx: BotContext): Promise<void> {
		const text = "text" in (ctx.message ?? {}) ? (ctx.message as { text: string }).text : null;
		if (!text || text.startsWith("/")) return;

		const userId = ctx.from?.id?.toString();
		if (!userId) return;

		const session = ctx.userSession;

		if (!session?.provider || !session.model || !session.encryptedApiKey) {
			await ctx.reply("Please set up your AI model first with /setup");
			return;
		}

		// Process message in the per-user queue
		await queue.enqueue(userId, async () => {
			// Show typing indicator
			await ctx.sendChatAction("typing");

			// Repeat "typing..." indicator during long AI/MCP calls
			// Telegram drops typing status after ~5 seconds
			const typingInterval = setInterval(() => {
				ctx.sendChatAction("typing").catch(() => {
					/* ignore — best-effort */
				});
			}, 4_000);

			try {
				const apiKey = decrypt(session.encryptedApiKey!, config.encryptionSecret);
				const mcpClient = await mcpPool.getClient(userId);

				const result = await routeMessage({
					provider: session.provider!,
					apiKey,
					modelName: session.model!,
					mcpClient,
					history: session.history,
					userMessage: text,
					maxHistory: config.maxHistory,
				});

				// Update history in DB
				ctx.store.updateHistory(userId, result.updatedHistory);

				// Send reply in chunks (Telegram 4096-char limit)
				const sanitized = sanitizeForTelegram(result.reply);
				const chunks = chunkMessage(sanitized);

				for (const chunk of chunks) {
					try {
						await ctx.reply(chunk, {
							parse_mode: "Markdown",
							link_preview_options: { is_disabled: true },
						});
					} catch {
						// Fallback: send without Markdown if parsing fails
						await ctx.reply(chunk);
					}
				}
			} catch (error) {
				logger.error("Message handler error", { userId, error: String(error) });
				await ctx.reply("Something went wrong. Please try again.");
			} finally {
				clearInterval(typingInterval);
			}
		});
	};
}
