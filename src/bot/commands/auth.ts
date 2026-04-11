import { Markup } from "telegraf";
import { type BotContext } from "../middleware/session.js";
import { type McpProcessPool } from "../../mcp/pool.js";
import { type Config } from "../../lib/config.js";
import { requestLogin, verifyOtp, writeSessionFile } from "../../auth/fibx-auth.js";
import { truncateAddress } from "../../lib/format.js";
import { logger } from "../../lib/logger.js";

export function createAuthHandlers(config: Config, mcpPool: McpProcessPool) {
	async function authCommand(ctx: BotContext): Promise<void> {
		if (ctx.userSession?.fibxAddr) {
			await ctx.reply(
				`You're already logged in as \`${truncateAddress(ctx.userSession.fibxAddr)}\`\n\n` +
					"Want to re-authenticate?",
				{
					parse_mode: "Markdown",
					...Markup.inlineKeyboard([
						[Markup.button.callback("Re-authenticate", "auth:start")],
						[Markup.button.callback("Cancel", "auth:cancel")],
					]),
				}
			);
			return;
		}

		await promptEmail(ctx);
	}

	async function promptEmail(ctx: BotContext): Promise<void> {
		const userId = ctx.from!.id.toString();
		ctx.store.setAuthState(userId, "auth:email");

		await ctx.reply(
			"*FibX Login*\n\n" + "Enter the email address associated with your fibx account:",
			{ parse_mode: "Markdown" }
		);
	}

	async function handleEmail(ctx: BotContext, email: string): Promise<void> {
		const userId = ctx.from!.id.toString();

		try {
			await requestLogin(config.fibxServerUrl, email);
			ctx.store.setAuthState(userId, "auth:otp", email);
			await ctx.reply(
				`Verification code sent to *${email}*.\n\n` +
					"Enter the verification code from your inbox:",
				{ parse_mode: "Markdown" }
			);
		} catch (error) {
			logger.error("Auth email failed", { userId, error: String(error) });
			ctx.store.deleteAuthState(userId);
			await ctx.reply("Login failed. Please try again.\n\nUse /auth to start over.", {
				...Markup.inlineKeyboard([Markup.button.callback("Try Again", "auth:start")]),
			});
		}
	}

	async function handleOtp(ctx: BotContext, code: string): Promise<void> {
		const userId = ctx.from!.id.toString();
		const state = ctx.store.getAuthState(userId);

		if (!state || state.step !== "auth:otp" || !state.email) return;

		try {
			const result = await verifyOtp(config.fibxServerUrl, state.email, code);

			// Write session file for the MCP process
			const userHome = mcpPool.getUserHome(userId);
			await writeSessionFile(userHome, result);

			// Upsert session — ensures row exists even if user hasn't run /setup yet
			const existing = ctx.store.get(userId);
			ctx.store.upsert(userId, {
				provider: existing?.provider ?? null,
				model: existing?.model ?? null,
				encryptedApiKey: existing?.encryptedApiKey ?? null,
				fibxAddr: result.walletAddress,
				history: existing?.history ?? [],
			});
			ctx.store.deleteAuthState(userId);

			// Restart MCP process to pick up new session
			await mcpPool.restart(userId);

			await ctx.reply(
				"*Logged In*\n\n" +
					`Address: \`${result.walletAddress}\`\n\n` +
					"You're all set! Try _\"What's my balance on Base?\"_",
				{ parse_mode: "Markdown" }
			);
		} catch (error) {
			logger.error("Auth OTP failed", { userId, error: String(error) });
			await ctx.reply("Verification failed. Please try again.\n\nUse /auth to start over.", {
				...Markup.inlineKeyboard([Markup.button.callback("Try Again", "auth:start")]),
			});
		}
	}

	return { authCommand, promptEmail, handleEmail, handleOtp };
}
