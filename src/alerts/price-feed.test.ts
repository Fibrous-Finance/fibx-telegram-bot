import { describe, expect, it } from "vitest";
import { SUPPORTED_CHAINS, isSupportedChain } from "./price-feed.js";

/**
 * Alerts poll the Fibrous token list per chain. Fibrous delisted Citrea on
 * 2026-08-10 and its graph service now answers 404, so an alert on Citrea can
 * never resolve a token or a price — it would retry against a dead endpoint
 * forever. Re-adding "citrea" to SUPPORTED_CHAINS is what makes these fail.
 */
describe("alert chain support", () => {
	it("does not accept citrea", () => {
		expect(isSupportedChain("citrea")).toBe(false);
	});

	it("offers base, hyperevm and monad", () => {
		expect([...SUPPORTED_CHAINS]).toEqual(["base", "hyperevm", "monad"]);
	});
});
