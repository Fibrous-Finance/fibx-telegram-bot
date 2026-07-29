import { logger } from "../lib/logger.js";

const FIBROUS_GRAPH_URL = "https://graph.fibrous.finance";

export const SUPPORTED_CHAINS = ["base", "citrea", "hyperevm", "monad"] as const;
export type ChainName = (typeof SUPPORTED_CHAINS)[number];

export function isSupportedChain(value: string): value is ChainName {
	return (SUPPORTED_CHAINS as readonly string[]).includes(value);
}

export interface TokenInfo {
	symbol: string;
	address: string;
	/** USD price as reported by Fibrous; undefined when no price is known. */
	price?: number;
}

/**
 * Fetches the Fibrous token list for a chain — the same public endpoint the
 * fibx CLI uses. Returns tokens keyed by lowercase address plus a secondary
 * index by lowercase symbol for resolution at alert-creation time.
 */
export async function fetchTokens(chain: ChainName): Promise<{
	byAddress: Map<string, TokenInfo>;
	bySymbol: Map<string, TokenInfo>;
}> {
	const res = await fetch(`${FIBROUS_GRAPH_URL}/${chain}/tokens`, {
		signal: AbortSignal.timeout(10_000),
	});
	if (!res.ok) {
		throw new Error(`Fibrous tokens request failed: HTTP ${res.status}`);
	}

	const raw = (await res.json()) as Record<
		string,
		{ symbol?: string; address?: string; price?: string }
	>;

	const byAddress = new Map<string, TokenInfo>();
	const bySymbol = new Map<string, TokenInfo>();

	for (const entry of Object.values(raw)) {
		if (!entry?.symbol || !entry?.address) continue;
		const price = entry.price ? Number(entry.price) : undefined;
		const token: TokenInfo = {
			symbol: entry.symbol,
			address: entry.address.toLowerCase(),
			price: Number.isFinite(price) ? price : undefined,
		};
		byAddress.set(token.address, token);
		bySymbol.set(token.symbol.toLowerCase(), token);
	}

	logger.debug("Fetched Fibrous token list", { chain, tokens: byAddress.size });
	return { byAddress, bySymbol };
}
