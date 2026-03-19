const TELEGRAM_MAX_LENGTH = 4096;

/** Convert standard Markdown (AI output) to Telegram-compatible format */
export function sanitizeForTelegram(text: string): string {
	return (
		text
			// **bold** → *bold* (Telegram uses single asterisk)
			.replace(/\*\*([^\n]+?)\*\*/g, "*$1*")
			// __bold__ → *bold*
			.replace(/__([^\n]+?)__/g, "*$1*")
			// # Headers → *bold text*
			.replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
			// --- horizontal rules → blank
			.replace(/^-{3,}$/gm, "")
			// Collapse excess blank lines
			.replace(/\n{3,}/g, "\n\n")
	);
}

/** Split long messages at newline boundaries respecting Telegram's 4096-char limit */
export function chunkMessage(text: string): string[] {
	if (text.length <= TELEGRAM_MAX_LENGTH) return [text];

	const chunks: string[] = [];
	let remaining = text;

	while (remaining.length > 0) {
		if (remaining.length <= TELEGRAM_MAX_LENGTH) {
			chunks.push(remaining);
			break;
		}

		const cutoff = remaining.lastIndexOf("\n", TELEGRAM_MAX_LENGTH);
		// Hard-cut if no newline found to prevent infinite loop
		const end = cutoff > 0 ? cutoff : TELEGRAM_MAX_LENGTH;

		chunks.push(remaining.slice(0, end));
		remaining = remaining.slice(end === cutoff ? end + 1 : end);
	}

	return chunks;
}

/** Truncate an address for display: 0x1234...abcd */
export function truncateAddress(address: string): string {
	if (address.length <= 14) return address;
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
