import { Markup } from "telegraf";
import { type BotContext } from "../middleware/session.js";

export async function helpCommand(ctx: BotContext): Promise<void> {
	await ctx.reply(
		"*FibX Bot — Help*\n\n" +
			"*Setup*\n" +
			"• /setup — Choose your AI provider, model, and API key\n" +
			"• /auth — Connect your fibx wallet\n" +
			"• /model — Switch AI model or change provider\n" +
			"• /status — View your current session (provider, model, wallet)\n\n" +
			"*Session*\n" +
			"• /clear — Reset conversation history\n" +
			"• /deletekey — Remove your stored API key\n\n" +
			"*What I can do:*\n" +
			'• Token swaps — _"Swap 0.1 ETH to USDC on Base"_\n' +
			'• Portfolio — _"Show my portfolio"_\n' +
			'• Transfers — _"Send 10 USDC to 0x..."_\n' +
			'• Aave V3 — _"Supply 100 USDC to Aave"_\n' +
			'• Health check — _"What\'s my Aave health factor?"_\n' +
			'• Tx status — _"Check tx status 0x..."_\n\n' +
			"Just describe what you want — in any language!",
		{
			parse_mode: "Markdown",
			...Markup.inlineKeyboard([
				[Markup.button.callback("About FibX", "about")],
				[Markup.button.url("Website", "https://fibrous.finance")],
				[Markup.button.url("Documentation", "https://docs.fibrous.finance/fibx-agent")],
			]),
		}
	);
}
