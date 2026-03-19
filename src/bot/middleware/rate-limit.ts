import { type MiddlewareFn } from "telegraf";
import { type BotContext } from "./session.js";

interface UserBucket {
	tokens: number;
	lastRefill: number;
}

const BUCKET_CLEANUP_INTERVAL_MS = 600_000;
const BUCKET_MAX_IDLE_MS = 3_600_000;

export function rateLimitMiddleware(limit: number): MiddlewareFn<BotContext> {
	const buckets = new Map<string, UserBucket>();

	// Prune stale buckets to prevent unbounded memory growth
	const cleanupTimer = setInterval(() => {
		const now = Date.now();
		for (const [userId, bucket] of buckets) {
			if (now - bucket.lastRefill > BUCKET_MAX_IDLE_MS) {
				buckets.delete(userId);
			}
		}
	}, BUCKET_CLEANUP_INTERVAL_MS);
	cleanupTimer.unref();

	return async (ctx, next) => {
		const userId = ctx.from?.id?.toString();
		if (!userId) return next();

		const now = Date.now();
		let bucket = buckets.get(userId);

		if (!bucket) {
			bucket = { tokens: limit, lastRefill: now };
			buckets.set(userId, bucket);
		}

		const elapsed = now - bucket.lastRefill;
		const refill = Math.floor((elapsed / 60_000) * limit);
		if (refill > 0) {
			bucket.tokens = Math.min(limit, bucket.tokens + refill);
			bucket.lastRefill = now;
		}

		if (bucket.tokens <= 0) {
			await ctx.reply("Too many messages — please wait a moment before sending another.");
			return;
		}

		bucket.tokens--;
		return next();
	};
}
