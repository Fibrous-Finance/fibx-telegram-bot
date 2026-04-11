export type Provider = "openai" | "claude" | "gemini";

export interface ModelOption {
	id: string;
	label: string;
	description: string;
}

export const MODEL_OPTIONS: Record<Provider, ModelOption[]> = {
	openai: [
		{ id: "gpt-5.4-nano", label: "GPT-5.4 Nano", description: "Fastest & cheapest" },
		{ id: "gpt-5.4-mini", label: "GPT-5.4 Mini", description: "Fast & capable" },
		{ id: "gpt-5.4", label: "GPT-5.4", description: "Most powerful" },
	],
	claude: [
		{ id: "claude-haiku-4-5", label: "Haiku 4.5", description: "Fast & cheap" },
		{ id: "claude-sonnet-4-6", label: "Sonnet 4.6", description: "Balanced" },
		{ id: "claude-opus-4-6", label: "Opus 4.6", description: "Most capable" },
	],
	gemini: [
		{
			id: "gemini-3.1-flash-lite-preview",
			label: "Gemini 3.1 Flash-Lite",
			description: "Fastest & cheapest",
		},
		{
			id: "gemini-3-flash-preview",
			label: "Gemini 3 Flash",
			description: "General purpose & fast",
		},
		{ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Balanced & robust" },
		{ id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Deep reasoning" },
		{
			id: "gemini-3.1-pro-preview",
			label: "Gemini 3.1 Pro",
			description: "State-of-the-art preview",
		},
	],
};

export const MODEL_DEFAULTS: Record<Provider, string> = {
	openai: "gpt-5.4-mini",
	claude: "claude-sonnet-4-6",
	gemini: "gemini-2.5-flash",
};

export interface UserSession {
	provider: Provider | null;
	model: string | null;
	encryptedApiKey: string | null;
	fibxAddr: string | null;
	history: { role: "user" | "assistant"; content: string }[];
}

export const PROVIDER_LABELS: Record<Provider, string> = {
	openai: "OpenAI",
	claude: "Claude",
	gemini: "Gemini",
};
