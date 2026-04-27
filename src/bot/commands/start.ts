import { Markup } from "telegraf";
import { type BotContext } from "../middleware/session.js";

export async function startCommand(ctx: BotContext): Promise<void> {
	const name = ctx.from?.first_name ?? "there";

	await ctx.reply(
		`Hey ${name}, welcome to *FibX Bot*!\n\n` +
			"I'm your AI-powered DeFi assistant for *EVM chains*. " +
			"Swap tokens, manage your portfolio, and interact with Aave — all through natural conversation.\n\n" +
			"*Get started in 3 steps:*\n" +
			"1. /setup — Choose your AI provider and model\n" +
			"2. /auth — Log in to your FibX account\n" +
			'3. Start chatting — try _"How much USDC for 0.1 ETH?"_\n\n' +
			'You can ask for price quotes without logging in!\n' +
			"Need help? Use /help to see everything I can do.",
		{
			parse_mode: "Markdown",
			...Markup.inlineKeyboard([
				[Markup.button.callback("Setup AI Model", "setup")],
				[Markup.button.callback("Log In to FibX", "auth")],
				[
					Markup.button.callback("Help", "help"),
					Markup.button.callback("About FibX", "about"),
				],
			]),
		}
	);
}
