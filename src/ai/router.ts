import { generateText, stepCountIs } from "ai";
import { type MCPClient } from "@ai-sdk/mcp";
import { createModel } from "./providers.js";
import { getSystemPrompt } from "./system-prompt.js";
import { PROVIDER_LABELS, type Provider } from "../session/types.js";
import { logger } from "../lib/logger.js";

export interface AiRouterInput {
	provider: Provider;
	apiKey: string;
	modelName: string;
	mcpClient: MCPClient;
	history: { role: "user" | "assistant"; content: string }[];
	userMessage: string;
	maxHistory: number;
}

export interface AiRouterResult {
	reply: string;
	updatedHistory: { role: "user" | "assistant"; content: string }[];
}

export async function routeMessage(input: AiRouterInput): Promise<AiRouterResult> {
	const { provider, apiKey, modelName, mcpClient, history, userMessage, maxHistory } = input;

	// Trim history to maxHistory entries
	const trimmed = history.slice(-maxHistory);

	const messages: { role: "user" | "assistant"; content: string }[] = [
		...trimmed,
		{ role: "user" as const, content: userMessage },
	];

	const label = PROVIDER_LABELS[provider] ?? provider;

	try {
		const tools = await mcpClient.tools();
		const model = createModel(provider, apiKey, modelName);

		const result = await generateText({
			model,
			system: getSystemPrompt(),
			messages,
			tools,
			stopWhen: stepCountIs(10),

			onStepFinish({ stepNumber, finishReason, usage }) {
				logger.debug("AI step completed", {
					step: stepNumber,
					reason: finishReason,
					tokens: usage.totalTokens,
				});
			},

			experimental_onToolCallFinish({ toolCall, durationMs }) {
				logger.debug("Tool call completed", {
					toolName: toolCall.toolName,
					durationMs,
				});
			},
		});

		const reply = result.text || "I processed your request but have no text response.";

		const updatedHistory: { role: "user" | "assistant"; content: string }[] = [
			...trimmed,
			{ role: "user", content: userMessage },
			{ role: "assistant", content: reply },
		];

		logger.debug("AI response", {
			provider,
			steps: result.steps.length,
			responseLength: reply.length,
		});

		return { reply, updatedHistory };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const lowerMsg = errorMsg.toLowerCase();

		// Extract HTTP status from Vercel AI SDK's APICallError
		const statusCode =
			error instanceof Error && "statusCode" in error
				? (error as { statusCode: number }).statusCode
				: undefined;

		logger.error("AI router error", { provider, modelName, error: errorMsg, statusCode });

		let userMessage_: string;

		// — Authentication errors —
		if (
			statusCode === 401 ||
			statusCode === 403 ||
			lowerMsg.includes("unauthorized") ||
			lowerMsg.includes("invalid api key") ||
			lowerMsg.includes("permission denied") ||
			lowerMsg.includes("api key not valid")
		) {
			userMessage_ = "API key is invalid or expired. Use /setup to configure a new key.";
		}
		// — Rate limit errors —
		else if (
			statusCode === 429 ||
			lowerMsg.includes("rate limit") ||
			lowerMsg.includes("rate_limit") ||
			lowerMsg.includes("too many requests") ||
			lowerMsg.includes("resource_exhausted")
		) {
			userMessage_ = `${label} rate limit exceeded — please wait a minute and try again.`;
		}
		// — Quota / billing errors —
		else if (
			lowerMsg.includes("insufficient_quota") ||
			lowerMsg.includes("quota") ||
			lowerMsg.includes("billing") ||
			lowerMsg.includes("exceeded your current") ||
			lowerMsg.includes("payment required")
		) {
			userMessage_ = `Your ${label} API quota is exhausted. Check your billing dashboard.`;
		}
		// — Content filter / safety errors —
		else if (
			lowerMsg.includes("content filter") ||
			lowerMsg.includes("safety") ||
			lowerMsg.includes("blocked") ||
			lowerMsg.includes("harm_category")
		) {
			userMessage_ = "Response blocked by content filters. Try rephrasing.";
		}
		// — Model not found —
		else if (
			statusCode === 404 ||
			lowerMsg.includes("model not found") ||
			lowerMsg.includes("does not exist") ||
			lowerMsg.includes("not_found")
		) {
			userMessage_ = `Model "${modelName}" is not available. Use /model to switch.`;
		}
		// — Context length —
		else if (
			lowerMsg.includes("context length") ||
			lowerMsg.includes("token limit") ||
			lowerMsg.includes("too long")
		) {
			userMessage_ = "Conversation too long. Run /clear to reset history.";
		}
		// — Timeout / network errors —
		else if (
			lowerMsg.includes("timeout") ||
			lowerMsg.includes("timed out") ||
			lowerMsg.includes("econnrefused") ||
			lowerMsg.includes("enotfound") ||
			lowerMsg.includes("fetch failed") ||
			lowerMsg.includes("network")
		) {
			userMessage_ = `Could not reach ${label} — service may be temporarily unavailable.`;
		}
		// — Server errors —
		else if (statusCode && statusCode >= 500) {
			userMessage_ = `${label} is experiencing server issues (${statusCode}). Try again later.`;
		}
		// — Fallback —
		else {
			userMessage_ = `${label} request failed. Try again or use /model to switch models.`;
		}

		return {
			reply: userMessage_,
			updatedHistory: [...trimmed, { role: "user", content: userMessage }],
		};
	}
}
