import { z } from "zod";

const configSchema = z.object({
	telegramBotToken: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
	encryptionSecret: z
		.string()
		.regex(
			/^[0-9a-f]{64}$/i,
			"BOT_ENCRYPTION_SECRET must be a 64-character hex string (32 bytes)"
		),
	fibxServerUrl: z.string().url("FIBX_SERVER_URL must be a valid URL"),
	mcpCommand: z.string().default("npx"),
	mcpArgs: z.array(z.string()).default(["-y", "fibx@latest", "mcp-start"]),
	logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
	maxHistory: z.number().int().positive().default(20),
	rateLimitPerMinute: z.number().int().positive().default(30),
	mcpIdleTimeoutMs: z.number().int().positive().default(300_000),
	webhookDomain: z.string().optional(),
	webhookSecretPath: z.string().optional(),
	port: z.number().int().positive().default(8080),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
	const raw = {
		telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
		encryptionSecret: process.env.BOT_ENCRYPTION_SECRET ?? "",
		fibxServerUrl: process.env.FIBX_SERVER_URL ?? "",
		mcpCommand: process.env.FIBX_MCP_COMMAND ?? "npx",
		mcpArgs: process.env.FIBX_MCP_ARGS
			? process.env.FIBX_MCP_ARGS.split(",")
			: ["-y", "fibx@latest", "mcp-start"],
		logLevel: process.env.LOG_LEVEL ?? "info",
		maxHistory: process.env.MAX_HISTORY ? Number(process.env.MAX_HISTORY) : 20,
		rateLimitPerMinute: process.env.RATE_LIMIT_PER_MINUTE
			? Number(process.env.RATE_LIMIT_PER_MINUTE)
			: 30,
		mcpIdleTimeoutMs: process.env.MCP_IDLE_TIMEOUT_MS
			? Number(process.env.MCP_IDLE_TIMEOUT_MS)
			: 300_000,
		webhookDomain: process.env.WEBHOOK_DOMAIN || undefined,
		webhookSecretPath: process.env.WEBHOOK_SECRET_PATH || undefined,
		port: process.env.PORT ? Number(process.env.PORT) : 8080,
	};

	const result = configSchema.safeParse(raw);

	if (!result.success) {
		const errors = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
		console.error(`Configuration errors:\n${errors.join("\n")}`);
		process.exit(1);
	}

	return result.data;
}
