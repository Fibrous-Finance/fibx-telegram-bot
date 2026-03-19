import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { type LanguageModel } from "ai";
import { type Provider } from "../session/types.js";

/**
 * Create a language model instance for the given provider.
 * The API key is decrypted by the caller and passed here.
 */
export function createModel(provider: Provider, apiKey: string, modelName: string): LanguageModel {
	switch (provider) {
		case "openai":
			return createOpenAI({ apiKey })(modelName);
		case "claude":
			return createAnthropic({ apiKey })(modelName);
		case "gemini":
			return createGoogleGenerativeAI({ apiKey })(modelName);
	}
}
