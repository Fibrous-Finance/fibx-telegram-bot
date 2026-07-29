import type { Telegraf } from "telegraf";
import type { BotContext } from "../bot/middleware/session.js";
import type { SessionStore, PriceAlert } from "../session/store.js";
import { fetchTokens, isSupportedChain, type ChainName } from "./price-feed.js";
import { formatUsd } from "../lib/format.js";
import { logger } from "../lib/logger.js";

export interface TriggeredAlert {
	alert: PriceAlert;
	currentPrice: number;
}

/**
 * Pure trigger check: an "above" alert fires once the price reaches or exceeds
 * the target, "below" once it reaches or falls under it. Tokens with no known
 * price never fire — a missing feed must not look like a price of zero, or
 * every "below" alert would fire on a feed outage.
 */
export function evaluateAlerts(
	alerts: PriceAlert[],
	pricesByChain: Map<string, Map<string, number>>
): TriggeredAlert[] {
	const triggered: TriggeredAlert[] = [];

	for (const alert of alerts) {
		const price = pricesByChain.get(alert.chain)?.get(alert.tokenAddress);
		if (price === undefined) continue;

		const fires =
			alert.direction === "above" ? price >= alert.targetPrice : price <= alert.targetPrice;

		if (fires) triggered.push({ alert, currentPrice: price });
	}

	return triggered;
}

/**
 * Polls Fibrous prices and notifies users whose alerts fired. Alerts are
 * one-shot: they are deleted when they fire (and also when the user has
 * blocked the bot, so a dead chat cannot make an alert retry forever).
 */
export class AlertMonitor {
	private timer: NodeJS.Timeout | null = null;
	private running = false;

	constructor(
		private readonly bot: Telegraf<BotContext>,
		private readonly store: SessionStore,
		private readonly pollIntervalMs: number
	) {}

	start(): void {
		if (this.timer) return;
		this.timer = setInterval(() => void this.poll(), this.pollIntervalMs);
		logger.info("Alert monitor started", { pollIntervalMs: this.pollIntervalMs });
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	/** One polling pass. Public for tests and for an immediate first run. */
	async poll(): Promise<void> {
		if (this.running) return; // a slow pass must not stack onto the next tick
		this.running = true;

		try {
			const alerts = this.store.allAlerts();
			if (alerts.length === 0) return;

			// Only fetch chains that actually have alerts.
			const chains = [...new Set(alerts.map((a) => a.chain))].filter(isSupportedChain);

			const pricesByChain = new Map<string, Map<string, number>>();
			for (const chain of chains) {
				try {
					const { byAddress } = await fetchTokens(chain as ChainName);
					const prices = new Map<string, number>();
					for (const token of byAddress.values()) {
						if (token.price !== undefined) prices.set(token.address, token.price);
					}
					pricesByChain.set(chain, prices);
				} catch (error) {
					// A failing chain skips this pass; its alerts simply wait.
					logger.warn("Price fetch failed", {
						chain,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			for (const { alert, currentPrice } of evaluateAlerts(alerts, pricesByChain)) {
				await this.notify(alert, currentPrice);
			}
		} finally {
			this.running = false;
		}
	}

	private async notify(alert: PriceAlert, currentPrice: number): Promise<void> {
		const direction = alert.direction === "above" ? "rose above" : "dropped below";
		const text =
			`*Price alert*\n\n` +
			`${alert.tokenSymbol} ${direction} ${formatUsd(alert.targetPrice)} on ${alert.chain}.\n` +
			`Current price: ${formatUsd(currentPrice)}`;

		try {
			await this.bot.telegram.sendMessage(alert.userId, text, { parse_mode: "Markdown" });
		} catch (error) {
			logger.warn("Alert notification failed; dropping alert", {
				alertId: alert.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		this.store.deleteAlert(alert.id);
	}
}
