import { Markup } from "telegraf";
import { type BotContext } from "../middleware/session.js";
import { encrypt } from "../../session/crypto.js";
import { MODEL_OPTIONS, PROVIDER_LABELS, type Provider } from "../../session/types.js";
import { type Config } from "../../lib/config.js";

export function createSetupHandlers(config: Config) {
	async function setupCommand(ctx: BotContext): Promise<void> {
		await ctx.reply(
			"*AI Model Setup*\n\n" +
				"Choose your AI provider. You'll need an API key from the provider's dashboard.\n\n" +
				"• *OpenAI* — Fast and reliable, great tool use\n" +
				"• *Claude* — Strong reasoning and analysis\n" +
				"• *Gemini* — Powerful multimodal capabilities",
			{
				parse_mode: "Markdown",
				...Markup.inlineKeyboard([
					[Markup.button.callback("OpenAI", "setup:provider:openai")],
					[Markup.button.callback("Claude", "setup:provider:claude")],
					[Markup.button.callback("Gemini", "setup:provider:gemini")],
				]),
			}
		);
	}

	async function handleProviderSelect(ctx: BotContext, provider: Provider): Promise<void> {
		const label = PROVIDER_LABELS[provider];
		const models = MODEL_OPTIONS[provider];

		const buttons = models.map((m) => [
			Markup.button.callback(
				`${m.label} — ${m.description}`,
				`setup:model:${provider}:${m.id}`
			),
		]);

		await ctx.editMessageText(`Provider: *${label}*\n\nNow choose a model:`, {
			parse_mode: "Markdown",
			...Markup.inlineKeyboard(buttons),
		});
	}

	async function handleModelSelect(
		ctx: BotContext,
		provider: Provider,
		modelId: string
	): Promise<void> {
		const userId = ctx.from!.id.toString();
		const models = MODEL_OPTIONS[provider];
		const model = models.find((m) => m.id === modelId);
		const label = PROVIDER_LABELS[provider];
		const modelLabel = model?.label ?? modelId;

		// Store pending selection in auth_states
		ctx.store.setAuthState(
			userId,
			"setup:api_key",
			undefined,
			JSON.stringify({ provider, modelId })
		);

		await ctx.editMessageText(
			`*${label}* — \`${modelLabel}\`\n\n` +
				"Send me your API key.\n\n" +
				"_Your key is encrypted with AES-256-GCM and never stored in plain text._",
			{ parse_mode: "Markdown" }
		);
	}

	async function handleApiKey(ctx: BotContext, apiKey: string): Promise<void> {
		const userId = ctx.from!.id.toString();
		const state = ctx.store.getAuthState(userId);

		if (!state || state.step !== "setup:api_key" || !state.data) return;

		const { provider, modelId } = JSON.parse(state.data) as {
			provider: Provider;
			modelId: string;
		};

		const encryptedKey = encrypt(apiKey, config.encryptionSecret);

		// Upsert session with model config
		const existing = ctx.store.get(userId);
		ctx.store.upsert(userId, {
			provider,
			model: modelId,
			encryptedApiKey: encryptedKey,
			fibxAddr: existing?.fibxAddr ?? null,
			history: existing?.history ?? [],
		});

		ctx.store.deleteAuthState(userId);

		// Delete the message containing the API key for security
		try {
			await ctx.deleteMessage();
		} catch {
			/* message may already be deleted */
		}

		const models = MODEL_OPTIONS[provider];
		const model = models.find((m) => m.id === modelId);

		await ctx.reply(
			"*Setup Complete*\n\n" +
				`Provider: *${PROVIDER_LABELS[provider]}*\n` +
				`Model: \`${model?.label ?? modelId}\`\n\n` +
				"Next step: Use /auth to log in to your FibX account.\n" +
				'Or just start chatting — try _"What can you do?"_',
			{
				parse_mode: "Markdown",
				...Markup.inlineKeyboard([Markup.button.callback("Log In to FibX", "auth")]),
			}
		);
	}

	return { setupCommand, handleProviderSelect, handleModelSelect, handleApiKey };
}
