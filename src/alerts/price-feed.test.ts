import { describe, expect, it } from "vitest";
import { SUPPORTED_CHAINS, isSupportedChain } from "./price-feed.js";

describe("alert chain support", () => {
	it("does not accept an unknown chain", () => {
		expect(isSupportedChain("unknown")).toBe(false);
	});

	it("offers base, hyperevm and monad", () => {
		expect([...SUPPORTED_CHAINS]).toEqual(["base", "hyperevm", "monad"]);
	});
});
