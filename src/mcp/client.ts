import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
import { logger } from "../lib/logger.js";

/**
 * Create an MCP client connected to the fibx CLI via stdio transport.
 *
 * Each user gets an isolated HOME directory so that session files,
 * config, and cache do not leak between Telegram users.
 */
export async function createFibxMcpClient(
	command: string,
	args: string[],
	userHome: string
): Promise<MCPClient> {
	const env: Record<string, string> = {
		...(process.env as Record<string, string>),
		HOME: userHome,
		XDG_CONFIG_HOME: join(userHome, ".config"),
		XDG_DATA_HOME: join(userHome, ".local", "share"),
		XDG_STATE_HOME: join(userHome, ".local", "state"),
		XDG_CACHE_HOME: join(userHome, ".cache"),
	};

	const transport = new StdioClientTransport({ command, args, env });

	const client = await createMCPClient({ transport });

	logger.debug("MCP client created", { command, args, userHome });

	return client;
}
