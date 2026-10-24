// #212: a turn that ended with no assistant text used to hand the renderer the whole
// diagnostic as the toast text — provider, model, the error's name, three stack frames with
// `app.asar` paths and a 1 KB sample of the last stream chunk. The diagnostic is still
// wanted, in the main-process log that Save Diagnostics exports; what reaches the user is a
// sentence and a next step.

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import { FakeStreamingChatModel } from "@langchain/core/utils/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyDocument } from "../../../src/lib/ai-edition/schema";
import { mainLogBuffer } from "../../diagnostics/main-log-buffer";

vi.mock("./chat-model", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./chat-model")>();
	return { ...actual, createOpenScreenChatModel: vi.fn() };
});

import { createOpenScreenChatModel } from "./chat-model";
import { EMPTY_REPLY_MESSAGE } from "./empty-reply";
import { invokeOpenScreenAgent, type OpenScreenAgentSink } from "./service";

const modelMock = vi.mocked(createOpenScreenChatModel);

/** The exact error the 2026-10-23 end-to-end run put in the toast: LangChain's own message,
 * with the packaged app's frames. */
function productionError(): Error {
	const error = new Error("Received empty response from chat model call.");
	error.stack = [
		"Error: Received empty response from chat model call.",
		"    at D7._generateUncached (file:///Users/me/dev/projects/showhow/release/1.6.0/mac-arm64/Showhow.app/Contents/Resources/app.asar/dist-electron/update-settings-uYjC7FQn.js:45097:31)",
		"    at async D7.invoke (file:///Users/me/dev/projects/showhow/release/1.6.0/mac-arm64/Showhow.app/Contents/Resources/app.asar/dist-electron/update-settings-uYjC7FQn.js:44917:13)",
	].join("\n");
	return error;
}

/** A model whose only answer is to throw, the way a provider that returns a non-SSE body
 * makes the real one throw partway through the stream. */
class ThrowingModel extends BaseChatModel {
	_llmType(): string {
		return "throwing";
	}

	override bindTools(): this {
		return this;
	}

	async _generate(): Promise<ChatResult> {
		throw productionError();
	}
}

/** Anything a user could read as a path, a frame or a developer field. */
const LEAKS: RegExp[] = [
	/file:\/\//,
	/app\.asar/,
	/\.js:\d+:\d+/,
	/\bat \w+[._]/,
	/stack=/,
	/provider=/,
	/model=/,
	/chat_model_chunks/,
	/Last chunk/,
	/\bError:/,
];

function recordingSink() {
	const errors: string[] = [];
	const sink: OpenScreenAgentSink = {
		text: () => undefined,
		thinking: () => undefined,
		toolStart: () => undefined,
		toolEnd: () => undefined,
		error: (message) => {
			errors.push(message);
		},
	};
	return { sink, errors };
}

async function runTurn(sink: OpenScreenAgentSink) {
	return invokeOpenScreenAgent({
		document: createEmptyDocument({ projectId: "proj_212", title: "Demo" }),
		model: { provider: "openrouter", model: "anthropic/claude-haiku-5.5", apiKey: "sk-test" },
		history: [],
		userMessage: "Add a title card at the start that says Client onboarding demo.",
		sink,
	});
}

function loggedText(): string {
	return mainLogBuffer
		.snapshot()
		.map((entry) => entry.text)
		.join("\n");
}

describe("a turn with no assistant text (#212)", () => {
	let consoleError: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		mainLogBuffer.clear();
		modelMock.mockReset();
		consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		consoleError.mockRestore();
		mainLogBuffer.clear();
	});

	it("when the stream throws, the user gets a sentence and the log keeps the frames", async () => {
		modelMock.mockResolvedValue(new ThrowingModel({}) as never);
		const { sink, errors } = recordingSink();

		const result = await runTurn(sink);

		expect(result.text).toBe("");
		// The symptom first: nothing a person could read as a path, a frame or a dev field.
		for (const shown of [result.reason ?? "", ...errors]) {
			for (const leak of LEAKS) expect(shown).not.toMatch(leak);
		}
		expect(result.code).toBe("empty-reply");
		expect(result.reason).toBe(EMPTY_REPLY_MESSAGE);
		expect(errors).toEqual([EMPTY_REPLY_MESSAGE]);

		const logged = loggedText();
		expect(logged).toContain("provider=openrouter");
		expect(logged).toContain("model=anthropic/claude-haiku-5.5");
		expect(logged).toContain("Received empty response from chat model call.");
		expect(logged).toContain("app.asar/dist-electron/update-settings-uYjC7FQn.js:45097:31");
		expect(logged).toContain("(no on_chat_model_stream events)");
		// The same line reaches the main-process console, which is the log a dev run shows.
		expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("provider=openrouter"));
	});

	it("when the stream ends with empty content, same sentence, and the chunk sample stays in the log", async () => {
		modelMock.mockResolvedValue(
			new FakeStreamingChatModel({ chunks: [new AIMessageChunk({ content: "" })] }) as never,
		);
		const { sink, errors } = recordingSink();

		const result = await runTurn(sink);

		expect(result.text).toBe("");
		for (const shown of [result.reason ?? "", ...errors]) {
			for (const leak of LEAKS) expect(shown).not.toMatch(leak);
		}
		expect(result.code).toBe("empty-reply");
		expect(errors).toEqual([EMPTY_REPLY_MESSAGE]);

		const logged = loggedText();
		expect(logged).toContain("provider=openrouter");
		expect(logged).toMatch(/chat_model_chunks=[1-9]/);
		expect(logged).toContain("Last chunk: {");
	});
});
