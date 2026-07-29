import { describe, it, expect } from "vitest";
import type { ModelMessage } from "ai";
import { trimHistory } from "./router.js";

const user = (content: string): ModelMessage => ({ role: "user", content });
const assistant = (content: string): ModelMessage => ({ role: "assistant", content });

/** Assistant turn that calls a tool, followed by the tool's result. */
const toolExchange = (id: string): ModelMessage[] => [
	{
		role: "assistant",
		content: [{ type: "tool-call", toolCallId: id, toolName: "get_quote", input: {} }],
	},
	{
		role: "tool",
		content: [
			{
				type: "tool-result",
				toolCallId: id,
				toolName: "get_quote",
				output: { type: "text", value: "1 ETH = 2000 USDC" },
			},
		],
	},
];

describe("trimHistory", () => {
	it("returns short histories untouched", () => {
		const history = [user("hi"), assistant("hello")];
		expect(trimHistory(history, 20)).toEqual(history);
	});

	it("keeps roughly the last maxHistory messages", () => {
		const history: ModelMessage[] = [];
		for (let i = 0; i < 10; i++) {
			history.push(user(`q${i}`), assistant(`a${i}`));
		}

		const trimmed = trimHistory(history, 6);
		expect(trimmed.length).toBeLessThanOrEqual(6);
		expect(trimmed[0]).toEqual(user("q7"));
	});

	// The reason this helper exists: a window that opens between a tool call
	// and its result is rejected by provider APIs (dangling tool-result), which
	// would 400 every later message until the user runs /clear.
	it("never lets the window open inside a tool exchange", () => {
		const history: ModelMessage[] = [
			user("swap please"),
			...toolExchange("call-1"),
			assistant("done"),
			user("price?"),
			...toolExchange("call-2"),
			assistant("2000"),
		];

		// A naive slice(-5) would start at the call-2 exchange's tool result.
		const trimmed = trimHistory(history, 5);

		expect(trimmed[0].role).toBe("user");
		// Every tool-result in the window must have its tool-call before it.
		const seenCalls = new Set<string>();
		for (const msg of trimmed) {
			if (Array.isArray(msg.content)) {
				for (const part of msg.content) {
					if (part.type === "tool-call") seenCalls.add(part.toolCallId);
					if (part.type === "tool-result") {
						expect(seenCalls.has(part.toolCallId)).toBe(true);
					}
				}
			}
		}
	});

	it("returns an empty window rather than a broken one when no user turn fits", () => {
		// Pathological: maxHistory smaller than a single tool exchange tail.
		const history: ModelMessage[] = [user("q"), ...toolExchange("call-1"), assistant("a")];

		const trimmed = trimHistory(history, 2);
		// slice starts at assistant("a") — not user — so it advances past it.
		for (const msg of trimmed) {
			expect(msg.role).not.toBe("tool");
		}
	});

	it("accepts legacy plain-text history rows", () => {
		// Rows stored before tool-call support: plain {role, content} strings.
		const legacy: ModelMessage[] = [user("old question"), assistant("old answer")];
		expect(trimHistory(legacy, 20)).toEqual(legacy);
	});
});
