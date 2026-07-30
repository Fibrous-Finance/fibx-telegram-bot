import { afterEach, describe, expect, it, vi } from "vitest";
import type { MCPClient } from "@ai-sdk/mcp";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const clientMocks = vi.hoisted(() => ({
	createFibxMcpClient: vi.fn(),
}));

vi.mock("./client.js", () => ({
	createFibxMcpClient: clientMocks.createFibxMcpClient,
}));

import { McpProcessPool } from "./pool.js";

const pools: McpProcessPool[] = [];
const tempDirs: string[] = [];

async function makePool(): Promise<{ pool: McpProcessPool; dataDir: string }> {
	const dataDir = await mkdtemp(join(tmpdir(), "fibx-mcp-pool-"));
	const pool = new McpProcessPool("fibx", ["mcp-start"], 300_000, dataDir);
	pools.push(pool);
	tempDirs.push(dataDir);
	return { pool, dataDir };
}

afterEach(async () => {
	await Promise.all(pools.splice(0).map((pool) => pool.shutdown()));
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
	clientMocks.createFibxMcpClient.mockReset();
});

describe("McpProcessPool.deleteUserHome", () => {
	it("closes the user's MCP client before removing only that user's HOME", async () => {
		const { pool } = await makePool();
		const userHome = pool.getUserHome("42");
		const otherUserHome = pool.getUserHome("43");
		let homeExistedWhenClientClosed = false;
		const client = {
			tools: vi.fn().mockResolvedValue({}),
			close: vi.fn().mockImplementation(async () => {
				homeExistedWhenClientClosed = existsSync(userHome);
			}),
		} as unknown as MCPClient;
		clientMocks.createFibxMcpClient.mockResolvedValueOnce(client);

		await pool.getClient("42");
		await writeFile(join(userHome, "session.json"), "secret");
		await mkdir(otherUserHome, { recursive: true });
		await writeFile(join(otherUserHome, "session.json"), "keep");

		await pool.deleteUserHome("42");

		expect(client.close).toHaveBeenCalledOnce();
		expect(homeExistedWhenClientClosed).toBe(true);
		expect(existsSync(userHome)).toBe(false);
		await expect(readFile(join(otherUserHome, "session.json"), "utf8")).resolves.toBe("keep");
		expect(pool.size).toBe(0);
	});

	it("rejects non-Telegram IDs without touching paths outside the managed user directory", async () => {
		const { pool, dataDir } = await makePool();
		const sentinel = join(dataDir, "sentinel.txt");
		await writeFile(sentinel, "keep");

		await expect(pool.deleteUserHome("../sentinel.txt")).rejects.toThrow(
			"Invalid Telegram user ID"
		);
		await expect(readFile(sentinel, "utf8")).resolves.toBe("keep");
		expect(clientMocks.createFibxMcpClient).not.toHaveBeenCalled();
	});
});
