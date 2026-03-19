import { type Context, type MiddlewareFn } from "telegraf";
import { type SessionStore } from "../../session/store.js";
import { type UserSession } from "../../session/types.js";

export interface BotContext extends Context {
	store: SessionStore;
	userSession: UserSession | null;
}

export function sessionMiddleware(store: SessionStore): MiddlewareFn<BotContext> {
	return async (ctx, next) => {
		ctx.store = store;
		ctx.userSession = ctx.from ? store.get(ctx.from.id.toString()) : null;
		return next();
	};
}
