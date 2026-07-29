import type { BotContext } from "../middleware/session.js";
import { fetchTokens, isSupportedChain, SUPPORTED_CHAINS } from "../../alerts/price-feed.js";
import { formatUsd } from "../../lib/format.js";
import { logger } from "../../lib/logger.js";

const MAX_ALERTS_PER_USER = 10;

const USAGE =
	"*Price alerts*\n\n" +
	"• `/alert <token> above|below <price> [chain]` — create\n" +
	"• `/alert list` — show your alerts\n" +
	"• `/alert delete <id>` — remove one\n\n" +
	"Examples:\n" +
	"`/alert ETH above 4000`\n" +
	"`/alert HYPE below 20 hyperevm`\n\n" +
	`Chains: ${SUPPORTED_CHAINS.join(", ")} (default: base)`;

export interface ParsedAlertArgs {
	symbol: string;
	direction: "above" | "below";
	targetPrice: number;
	chain: string;
}

/**
 * Parses "<token> above|below <price> [chain]". Returns a string describing
 * the problem when the input is not usable — the caller shows it verbatim.
 */
export function parseAlertArgs(args: string[]): ParsedAlertArgs | string {
	if (args.length < 3 || args.length > 4) return USAGE;

	const [symbol, directionRaw, priceRaw, chainRaw] = args;
	const direction = directionRaw.toLowerCase();
	if (direction !== "above" && direction !== "below") {
		return `Direction must be "above" or "below", got "${directionRaw}".`;
	}

	const targetPrice = Number(priceRaw.replace(/[$,]/g, ""));
	if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
		return `"${priceRaw}" is not a valid price.`;
	}

	const chain = (chainRaw ?? "base").toLowerCase();
	if (!isSupportedChain(chain)) {
		return `Unsupported chain "${chainRaw}". Supported: ${SUPPORTED_CHAINS.join(", ")}.`;
	}

	return { symbol: symbol.toUpperCase(), direction, targetPrice, chain };
}

export async function alertCommand(ctx: BotContext): Promise<void> {
	const userId = ctx.from!.id.toString();
	const text = (ctx.message && "text" in ctx.message ? ctx.message.text : "") ?? "";
	const args = text.split(/\s+/).slice(1);

	if (args.length === 0 || args[0].toLowerCase() === "help") {
		await ctx.reply(USAGE, { parse_mode: "Markdown" });
		return;
	}

	if (args[0].toLowerCase() === "list") {
		const alerts = ctx.store.alertsForUser(userId);
		if (alerts.length === 0) {
			await ctx.reply("No active alerts. Create one with `/alert ETH above 4000`.", {
				parse_mode: "Markdown",
			});
			return;
		}
		const lines = alerts.map(
			(a) =>
				`#${a.id} — ${a.tokenSymbol} ${a.direction} ${formatUsd(a.targetPrice)} (${a.chain})`
		);
		await ctx.reply(`*Your alerts*\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
		return;
	}

	if (args[0].toLowerCase() === "delete") {
		const id = Number(args[1]);
		if (!Number.isInteger(id)) {
			await ctx.reply("Usage: `/alert delete <id>` — find ids with `/alert list`.", {
				parse_mode: "Markdown",
			});
			return;
		}
		const removed = ctx.store.deleteAlertOwned(id, userId);
		await ctx.reply(removed ? `Alert #${id} deleted.` : `No alert #${id} found for you.`);
		return;
	}

	const parsed = parseAlertArgs(args);
	if (typeof parsed === "string") {
		await ctx.reply(parsed, { parse_mode: "Markdown" });
		return;
	}

	if (ctx.store.alertCount(userId) >= MAX_ALERTS_PER_USER) {
		await ctx.reply(
			`You already have ${MAX_ALERTS_PER_USER} alerts. Delete one first with /alert delete <id>.`
		);
		return;
	}

	// Resolve the token now so a typo fails at creation, not silently at
	// polling time, and the user sees the current price as confirmation.
	let token;
	try {
		const { bySymbol } = await fetchTokens(parsed.chain as never);
		token = bySymbol.get(parsed.symbol.toLowerCase());
	} catch (error) {
		logger.warn("Token resolution failed", {
			chain: parsed.chain,
			error: error instanceof Error ? error.message : String(error),
		});
		await ctx.reply("Could not reach the price feed. Please try again in a moment.");
		return;
	}

	if (!token) {
		await ctx.reply(
			`Token "${parsed.symbol}" was not found on ${parsed.chain}. Check the symbol or specify another chain.`
		);
		return;
	}

	const id = ctx.store.addAlert({
		userId,
		chain: parsed.chain,
		tokenSymbol: token.symbol,
		tokenAddress: token.address,
		direction: parsed.direction,
		targetPrice: parsed.targetPrice,
	});

	const current = token.price !== undefined ? ` Current price: ${formatUsd(token.price)}.` : "";
	await ctx.reply(
		`Alert #${id} set: ${token.symbol} ${parsed.direction} ${formatUsd(parsed.targetPrice)} on ${parsed.chain}.${current}\n` +
			`You will be notified once — alerts fire a single time.`
	);
}
