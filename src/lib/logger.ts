type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
	currentLevel = level;
}

function write(level: LogLevel, message: string, data?: Record<string, unknown>): void {
	if (LEVELS[level] < LEVELS[currentLevel]) return;

	const entry: Record<string, unknown> = {
		timestamp: new Date().toISOString(),
		level,
		message,
	};

	if (data) entry.data = data;

	const output = JSON.stringify(entry);
	if (level === "error" || level === "warn") {
		process.stderr.write(output + "\n");
	} else {
		process.stdout.write(output + "\n");
	}
}

export const logger = {
	debug: (msg: string, data?: Record<string, unknown>) => write("debug", msg, data),
	info: (msg: string, data?: Record<string, unknown>) => write("info", msg, data),
	warn: (msg: string, data?: Record<string, unknown>) => write("warn", msg, data),
	error: (msg: string, data?: Record<string, unknown>) => write("error", msg, data),
};
