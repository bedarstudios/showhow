// @vitest-environment jsdom
// #212: when the turn ends with no assistant text, the toast says what happened and what to
// do next, with a Try again action — never the main process's diagnostic (provider, model,
// stack frames, chunk sample), which stays in the main-process log.

import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyDocument } from "@/lib/ai-edition/schema";
import { useProjectStore } from "@/lib/ai-edition/store/projectStore";

const bridge = vi.hoisted(() => ({
	snapshot: {
		config: { provider: "openrouter", model: "anthropic/claude-haiku-5.5" },
		connectedProviders: ["openrouter"] as string[],
		availableProviders: [],
		credentialSummary: [],
	},
	chatRun: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/native/client", () => ({
	nativeBridgeClient: {
		aiEdition: {
			llmGetSnapshot: () => Promise.resolve(bridge.snapshot),
			chatListSessions: () =>
				Promise.resolve([{ id: "s1", title: "Chat", messageCount: 0, createdAt: "now" }]),
			chatCreateSession: () =>
				Promise.resolve({ id: "s1", title: "Chat", messageCount: 0, createdAt: "now" }),
			chatSelectSession: () => Promise.resolve({ id: "s1", messages: [] }),
			chatBudget: () => Promise.resolve(null),
			llmListProviderModels: () => Promise.resolve({ models: [] }),
			chatRun: (...args: unknown[]) => bridge.chatRun(...args),
		},
	},
}));

vi.mock("@/contexts/I18nContext", () => ({
	useI18n: () => ({ locale: "en", setLocale: () => undefined }),
	useScopedT: () => (key: string, vars?: Record<string, string | number>) =>
		vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorDialogsProvider } from "@/contexts/EditorDialogsContext";
import { ChatStripPanel } from "./LeftPanel";

/** What the main process used to put in `error`, verbatim from the 2026-10-23 run. */
const DIAGNOSTIC =
	"Empty response from model (provider=openrouter, model=anthropic/claude-haiku-5.5, " +
	"error=Error: Received empty response from chat model call. stack=Error: Received empty " +
	"response from chat model call. | at D7._generateUncached (file:///Users/mohamedb/dev/" +
	"projects/showhow/release/1.6.0/mac-arm64/Showhow.app/Contents/Resources/app.asar/" +
	"dist-electron/update-settings-uYjC7FQn.js:45097:31)). Last chunk: (no on_chat_model_stream events)";

const toastError = vi.mocked(toast.error);

beforeEach(() => {
	useProjectStore.setState({
		projectId: "p1",
		document: createEmptyDocument({ projectId: "p1", title: "Demo" }),
		revision: 1,
		dirty: false,
	});
	toastError.mockReset();
	bridge.chatRun.mockReset();
	(window as unknown as { electronAPI?: unknown }).electronAPI = {
		onAiEditionChatEvent: () => () => undefined,
	};
	Element.prototype.scrollTo = () => undefined;
});

afterEach(() => {
	cleanup();
	useProjectStore.setState({ projectId: null, document: null, revision: 0 });
	(window as unknown as { electronAPI?: unknown }).electronAPI = undefined;
});

function renderPanel() {
	return render(
		<TooltipProvider>
			<EditorDialogsProvider>
				<ChatStripPanel />
			</EditorDialogsProvider>
		</TooltipProvider>,
	);
}

async function sendPrompt(text: string) {
	const box = await screen.findByRole("textbox", { name: "chat.composerLabel" });
	await waitFor(() => expect(box).toBeEnabled());
	fireEvent.change(box, { target: { value: text } });
	fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
}

describe("Edit with AI toast when the AI sent no reply (#212)", () => {
	it("shows the short message with a next step and Try again, and none of the diagnostic", async () => {
		bridge.chatRun.mockResolvedValue({
			success: false,
			error: DIAGNOSTIC,
			errorCode: "empty-reply",
		});
		renderPanel();

		await sendPrompt("Add a title card at the start that says Client onboarding demo.");

		await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
		const [message, options] = toastError.mock.calls[0] as [
			string,
			{ description?: string; action?: { label: string; onClick: () => void } },
		];
		expect(message).toBe("chat.emptyReply");
		expect(options.description).toBe("chat.emptyReplyNextStep");
		expect(options.action?.label).toBe("chat.tryAgain");
		expect(JSON.stringify(toastError.mock.calls)).not.toMatch(
			/app\.asar|file:\/\/|stack=|provider=|_generateUncached/,
		);
	});

	it("Try again re-sends the same prompt to the same session", async () => {
		bridge.chatRun.mockResolvedValue({
			success: false,
			error: DIAGNOSTIC,
			errorCode: "empty-reply",
		});
		renderPanel();
		const prompt = "Add a title card at the start that says Client onboarding demo.";

		await sendPrompt(prompt);
		await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
		const [, options] = toastError.mock.calls[0] as [
			string,
			{ action?: { label: string; onClick: () => void } },
		];
		expect(bridge.chatRun).toHaveBeenCalledTimes(1);

		// The turn's `finally` has cleared the busy flag by the time a person reaches for the
		// toast; let React commit that render before pressing the action.
		await act(async () => undefined);
		options.action?.onClick();

		await waitFor(() => expect(bridge.chatRun).toHaveBeenCalledTimes(2));
		const [first, second] = bridge.chatRun.mock.calls as [unknown[], unknown[]];
		expect(second[0]).toBe(first[0]);
		expect(second[1]).toBe(first[1]);
		expect(second[2]).toBe(prompt);
	});

	it("a failure without a code still shows the main process's sentence", async () => {
		bridge.chatRun.mockResolvedValue({ success: false, error: "Chat session unavailable." });
		renderPanel();

		await sendPrompt("hello");

		await waitFor(() => expect(toastError).toHaveBeenCalledWith("Chat session unavailable."));
	});
});
