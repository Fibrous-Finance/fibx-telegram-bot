import { describe, it, expect } from "vitest";
import { evaluateAlerts } from "./monitor.js";
import type { PriceAlert } from "../session/store.js";
import { parseAlertArgs } from "../bot/commands/alert.js";

const WETH = "0x4200000000000000000000000000000000000006";

function alert(overrides: Partial<PriceAlert> = {}): PriceAlert {
	return {
		id: 1,
		userId: "42",
		chain: "base",
		tokenSymbol: "WETH",
		tokenAddress: WETH,
		direction: "above",
		targetPrice: 4000,
		createdAt: 0,
		...overrides,
	};
}

function prices(chain: string, map: Record<string, number>) {
	return new Map([[chain, new Map(Object.entries(map))]]);
}

describe("evaluateAlerts", () => {
	it("fires 'above' when the price reaches the target", () => {
		expect(evaluateAlerts([alert()], prices("base", { [WETH]: 4000 }))).toHaveLength(1);
		expect(evaluateAlerts([alert()], prices("base", { [WETH]: 3999.99 }))).toHaveLength(0);
	});

	it("fires 'below' when the price reaches the target from above", () => {
		const a = alert({ direction: "below", targetPrice: 3000 });
		expect(evaluateAlerts([a], prices("base", { [WETH]: 2999 }))).toHaveLength(1);
		expect(evaluateAlerts([a], prices("base", { [WETH]: 3001 }))).toHaveLength(0);
	});

	it("reports the current price with the triggered alert", () => {
		const [hit] = evaluateAlerts([alert()], prices("base", { [WETH]: 4100 }));
		expect(hit.currentPrice).toBe(4100);
	});

	// A feed outage yields no price for the token. Zero and undefined MUST be
	// distinguished — treating "no price" as 0 would fire every below-alert on
	// every outage.
	it("never fires when the token has no known price", () => {
		const below = alert({ direction: "below", targetPrice: 3000 });
		expect(evaluateAlerts([below], prices("base", {}))).toHaveLength(0);
		expect(evaluateAlerts([below], new Map())).toHaveLength(0);
	});

	it("only matches prices from the alert's own chain", () => {
		const a = alert({ chain: "monad" });
		expect(evaluateAlerts([a], prices("base", { [WETH]: 5000 }))).toHaveLength(0);
	});
});

describe("parseAlertArgs", () => {
	it("parses a full alert with defaults", () => {
		expect(parseAlertArgs(["eth", "above", "4000"])).toEqual({
			symbol: "ETH",
			direction: "above",
			targetPrice: 4000,
			chain: "base",
		});
	});

	it("accepts an explicit chain and price formatting", () => {
		expect(parseAlertArgs(["hype", "below", "$1,250.50", "hyperevm"])).toEqual({
			symbol: "HYPE",
			direction: "below",
			targetPrice: 1250.5,
			chain: "hyperevm",
		});
	});

	it("returns an error message for bad input", () => {
		expect(typeof parseAlertArgs(["eth", "sideways", "4000"])).toBe("string");
		expect(typeof parseAlertArgs(["eth", "above", "not-a-price"])).toBe("string");
		expect(typeof parseAlertArgs(["eth", "above", "-5"])).toBe("string");
		expect(typeof parseAlertArgs(["eth", "above", "4000", "dogechain"])).toBe("string");
		expect(typeof parseAlertArgs(["eth"])).toBe("string");
	});
});
