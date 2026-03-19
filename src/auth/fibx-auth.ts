import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../lib/logger.js";

export interface FibxAuthResult {
	userId: string;
	walletId: string;
	walletAddress: string;
	token: string;
}

/** Request an OTP email via fibx-server */
export async function requestLogin(serverUrl: string, email: string): Promise<void> {
	const res = await fetch(`${serverUrl}/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email }),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "Unknown error");
		logger.error("fibx login request failed", { status: res.status, body: text });
		throw new Error("Login request failed. Please try again.");
	}
}

/** Verify OTP and receive wallet + JWT */
export async function verifyOtp(
	serverUrl: string,
	email: string,
	code: string
): Promise<FibxAuthResult> {
	const res = await fetch(`${serverUrl}/auth/verify`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, code }),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "Unknown error");
		logger.error("fibx OTP verification failed", { status: res.status, body: text });
		throw new Error("Verification failed. Please check your code and try again.");
	}

	return (await res.json()) as FibxAuthResult;
}

/**
 * Resolve the fibx CLI config directory for a given user HOME.
 *
 * Mirrors what `env-paths('fibx').config` returns on each platform:
 * - macOS: userHome/Library/Preferences/fibx-nodejs
 * - Windows: userHome/AppData/Roaming/fibx-nodejs/Config
 * - Linux:  userHome/.config/fibx  (via XDG_CONFIG_HOME set by MCP client)
 */
function getFibxConfigDir(userHome: string): string {
	if (process.platform === "darwin") {
		return join(userHome, "Library", "Preferences", "fibx-nodejs");
	}
	if (process.platform === "win32") {
		return join(userHome, "AppData", "Roaming", "fibx-nodejs", "Config");
	}
	// Linux: XDG_CONFIG_HOME is set to userHome/.config by the MCP client
	return join(userHome, ".config", "fibx");
}

/**
 * Write a session file that the fibx CLI MCP process can read.
 *
 * The fibx CLI uses `env-paths('fibx').config` which resolves to
 * a platform-specific path. Since each user has an isolated HOME,
 * we mirror env-paths behavior under the user's virtual HOME.
 */
export async function writeSessionFile(userHome: string, auth: FibxAuthResult): Promise<void> {
	const configDir = getFibxConfigDir(userHome);
	await mkdir(configDir, { recursive: true });

	const session = {
		type: "privy" as const,
		userId: auth.userId,
		walletId: auth.walletId,
		walletAddress: auth.walletAddress,
		userJwt: auth.token,
		createdAt: new Date().toISOString(),
	};

	await writeFile(join(configDir, "session.json"), JSON.stringify(session, null, 2), "utf-8");
	logger.info("fibx session file written", {
		userHome,
		address: auth.walletAddress,
	});
}
