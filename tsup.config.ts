import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	target: "node18",
	outDir: "dist",
	clean: true,
	sourcemap: true,
	dts: false,
	splitting: false,
	external: [
		"telegraf",
		"ai",
		"@ai-sdk/mcp",
		"@ai-sdk/openai",
		"@ai-sdk/anthropic",
		"@ai-sdk/google",
		"@modelcontextprotocol/sdk",
		"better-sqlite3",
	],
});
