import { describe, expect, it, vi } from "vitest";
import type { BotContext } from "../middleware/session.js";
import type { McpProcessPool } from "../../mcp/pool.js";
import { SessionStore } from "../../session/store.js";
import { createDeleteKeyCommand } from "./deletekey.js";

describe("/deletekey", () => {
	it("removes the virtual HOME and stored session while retaining alerts", async () => {
		const calls: string[] = [];
		const deleteUserHome = vi.fn(async () => {
			calls.push("home");
		});
		const deleteStoredSession = vi.fn(() => {
			calls.push("store");
		});
		const reply = vi.fn().mockResolvedValue(undefined);
		const ctx = {
			from: { id: 42 },
			store: { delete: deleteStoredSession },
			reply,
		} as unknown as BotContext;
		const pool = { deleteUserHome } as unknown as McpProcessPool;

		await createDeleteKeyCommand(pool)(ctx);

		expect(deleteUserHome).toHaveBeenCalledWith("42");
		expect(deleteStoredSession).toHaveBeenCalledWith("42");
		expect(calls).toEqual(["home", "store"]);
		expect(reply).toHaveBeenCalledOnce();
		expect(reply.mock.calls[0][0]).toContain("Price alerts are retained");
		expect(reply.mock.calls[0][0]).toContain("/alert delete <id>");
	});

	it("deletes database credentials but reports partial failure if HOME cleanup fails", async () => {
		const deleteUserHome = vi.fn().mockRejectedValue(new Error("permission denied"));
		const deleteStoredSession = vi.fn();
		const reply = vi.fn().mockResolvedValue(undefined);
		const ctx = {
			from: { id: 42 },
			store: { delete: deleteStoredSession },
			reply,
		} as unknown as BotContext;
		const pool = { deleteUserHome } as unknown as McpProcessPool;

		await createDeleteKeyCommand(pool)(ctx);

		expect(deleteStoredSession).toHaveBeenCalledWith("42");
		expect(reply).toHaveBeenCalledOnce();
		expect(reply.mock.calls[0][0]).toContain("Credential deletion incomplete");
		expect(reply.mock.calls[0][0]).toContain("may still be present");
		expect(reply.mock.calls[0][0]).not.toContain("Credentials and session deleted");
	});

	it("retains the user's price alerts when deleting their session row", async () => {
		const store = new SessionStore(":memory:");
		try {
			store.upsert("42", {
				provider: "openai",
				model: "gpt-5.4-mini",
				encryptedApiKey: "encrypted-key",
				fibxAddr: "0x1234",
				history: [],
			});
			store.setAuthState("42", "auth:otp", "user@example.com");
			const alertId = store.addAlert({
				userId: "42",
				chain: "base",
				tokenSymbol: "WETH",
				tokenAddress: "0x4200000000000000000000000000000000000006",
				direction: "above",
				targetPrice: 4000,
			});
			const ctx = {
				from: { id: 42 },
				store,
				reply: vi.fn().mockResolvedValue(undefined),
			} as unknown as BotContext;
			const pool = {
				deleteUserHome: vi.fn().mockResolvedValue(undefined),
			} as unknown as McpProcessPool;

			await createDeleteKeyCommand(pool)(ctx);

			expect(store.get("42")).toBeNull();
			expect(store.getAuthState("42")).toBeNull();
			expect(store.alertsForUser("42").map((alert) => alert.id)).toEqual([alertId]);
		} finally {
			store.close();
		}
	});
});
