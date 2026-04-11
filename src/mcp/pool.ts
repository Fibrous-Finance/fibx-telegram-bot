import { type MCPClient } from "@ai-sdk/mcp";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { createFibxMcpClient } from "./client.js";
import { logger } from "../lib/logger.js";

interface PoolEntry {
	client: MCPClient;
	lastUsed: number;
}

/**
 * Manages per-user MCP child processes.
 *
 * - Spawns a new process when a user first sends a message
 * - Caches the process for subsequent messages
 * - Validates the cached client is still alive on each use
 * - Cleans up idle processes after a configurable timeout
 */
export class McpProcessPool {
	private pool = new Map<string, PoolEntry>();
	private cleanupTimer: ReturnType<typeof setInterval>;
	private readonly baseDir: string;

	constructor(
		private command: string,
		private args: string[],
		private idleTimeoutMs: number,
		dataDir: string
	) {
		this.baseDir = join(dataDir, "user-homes");

		// Prune idle processes every 60 seconds
		this.cleanupTimer = setInterval(() => this.pruneIdle(), 60_000);
		this.cleanupTimer.unref();
	}

	async getClient(userId: string, _attempt = 0): Promise<MCPClient> {
		const existing = this.pool.get(userId);

		if (existing) {
			// Validate the cached client is still alive with a timeout
			try {
				const toolsPromise = existing.client.tools();
				const timeoutPromise = new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error("MCP health check timed out")), 5_000)
				);
				await Promise.race([toolsPromise, timeoutPromise]);
			} catch {
				logger.warn("Stale MCP client detected, reconnecting", { userId });
				await this.kill(userId);
				// Guard against infinite reconnection
				if (_attempt >= 2) {
					throw new Error("Failed to establish stable MCP connection after retries.");
				}
				return this.getClient(userId, _attempt + 1);
			}
			existing.lastUsed = Date.now();
			return existing.client;
		}

		const userHome = join(this.baseDir, userId);
		await mkdir(userHome, { recursive: true });

		try {
			const client = await createFibxMcpClient(this.command, this.args, userHome);

			this.pool.set(userId, { client, lastUsed: Date.now() });
			logger.info("MCP process spawned", { userId, poolSize: this.pool.size });

			return client;
		} catch (error) {
			logger.error("Failed to spawn MCP process", {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw new Error("Failed to connect to fibx service. Please try again.", {
				cause: error,
			});
		}
	}

	/** Get the user's HOME directory for session file writing */
	getUserHome(userId: string): string {
		return join(this.baseDir, userId);
	}

	/** Kill and recreate a user's MCP process (e.g. after auth) */
	async restart(userId: string): Promise<MCPClient> {
		await this.kill(userId);
		return this.getClient(userId);
	}

	async kill(userId: string): Promise<void> {
		const entry = this.pool.get(userId);
		if (!entry) return;

		try {
			await entry.client.close();
		} catch {
			// Process may already be dead
		}
		this.pool.delete(userId);
		logger.debug("MCP process killed", { userId });
	}

	get size(): number {
		return this.pool.size;
	}

	private async pruneIdle(): Promise<void> {
		const now = Date.now();
		const toRemove: string[] = [];

		for (const [userId, entry] of this.pool) {
			if (now - entry.lastUsed > this.idleTimeoutMs) {
				toRemove.push(userId);
			}
		}

		if (toRemove.length > 0) {
			logger.info("Cleaning up idle MCP processes", { count: toRemove.length });
			await Promise.allSettled(toRemove.map((id) => this.kill(id)));
		}
	}

	async shutdown(): Promise<void> {
		clearInterval(this.cleanupTimer);

		const userIds = [...this.pool.keys()];
		if (userIds.length > 0) {
			logger.info("Shutting down all MCP processes", { count: userIds.length });
			await Promise.allSettled(userIds.map((id) => this.kill(id)));
		}
	}
}
