import { Markup } from "telegraf";
import { type BotContext } from "../middleware/session.js";

export async function aboutCommand(ctx: BotContext): Promise<void> {
	await ctx.reply(
		"*About FibX*\n\n" +
			"FibX is the AI-native DeFi toolkit for *EVM chains*, " +
			"powered by Fibrous.\n\n" +
			"*Supported chains:*\n" +
			"• Base (ETH) — with Aave V3\n" +
			"• Citrea (cBTC)\n" +
			"• HyperEVM (HYPE)\n" +
			"• Monad (MON)\n\n" +
			"*Key capabilities:*\n" +
			"• Price quotes without login\n" +
			"• DEX-aggregated swaps via Fibrous\n" +
			"• Cross-chain portfolio with USD values\n" +
			"• Native & ERC-20 token transfers\n" +
			"• Aave V3 supply, borrow, repay, withdraw\n" +
			"• Custom RPC configuration\n\n" +
			"This bot is a live example of what you can build with " +
			"fibx's MCP server.",
		{
			parse_mode: "Markdown",
			...Markup.inlineKeyboard([
				[
					Markup.button.url("Website", "https://fibrous.finance"),
					Markup.button.url("Docs", "https://docs.fibrous.finance/fibx-agent"),
				],
				[
					Markup.button.url(
						"GitHub",
						"https://github.com/Fibrous-Finance/fibx/tree/main"
					),
					Markup.button.url("npm", "https://npmjs.com/package/fibx"),
				],
				[Markup.button.url("Twitter/X", "https://x.com/FibrousFinance")],
			]),
		}
	);
}
