import { Markup } from "telegraf";
import { type BotContext } from "../middleware/session.js";
import { MODEL_OPTIONS, PROVIDER_LABELS, type Provider } from "../../session/types.js";

export async function modelCommand(ctx: BotContext): Promise<void> {
	const session = ctx.userSession;

	if (!session?.provider || !session.model) {
		await ctx.reply("No AI model configured yet. Use /setup to get started.");
		return;
	}

	const provider = session.provider;
	const models = MODEL_OPTIONS[provider];
	const currentModel = models.find((m) => m.id === session.model);

	const modelButtons = models
		.filter((m) => m.id !== session.model)
		.map((m) => [
			Markup.button.callback(
				`${m.label} — ${m.description}`,
				`model:switch:${provider}:${m.id}`
			),
		]);

	const changeProviderRow = [
		Markup.button.callback("Change Provider (requires new API key)", "setup"),
	];

	await ctx.reply(
		"*Switch Model*\n\n" +
			`Current: *${PROVIDER_LABELS[provider]}* — \`${currentModel?.label ?? session.model}\`\n\n` +
			(modelButtons.length > 0
				? "Choose a different model:"
				: "No other models available for this provider."),
		{
			parse_mode: "Markdown",
			...Markup.inlineKeyboard([...modelButtons, changeProviderRow]),
		}
	);
}

export async function handleModelSwitch(
	ctx: BotContext,
	provider: Provider,
	modelId: string
): Promise<void> {
	const userId = ctx.from!.id.toString();
	const session = ctx.userSession;

	if (!session?.encryptedApiKey) {
		await ctx.reply("No API key found. Run /setup first.");
		return;
	}

	ctx.store.updateModel(userId, provider, modelId, session.encryptedApiKey);

	const model = MODEL_OPTIONS[provider]?.find((m) => m.id === modelId);

	await ctx.editMessageText(`*Model Updated*\n\n` + `Now using: \`${model?.label ?? modelId}\``, {
		parse_mode: "Markdown",
	});
}
