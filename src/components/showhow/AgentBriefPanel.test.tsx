// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { act, cleanup, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import type {
	AgentBrief,
	AgentBriefPreview,
	AgentBriefRunResult,
	AgentBriefStatus,
} from "@/lib/showhow/agentBrief";
import {
	AgentBriefPanel,
	AgentBriefSheets,
	CopyForAgentButton,
	useAgentBrief,
} from "./AgentBriefPanel";

const render = (node: ReactNode) => rtlRender(<I18nProvider>{node}</I18nProvider>);

function Harness({ bundleDir }: { bundleDir: string }) {
	const brief = useAgentBrief(bundleDir);
	return (
		<>
			<CopyForAgentButton brief={brief} />
			<AgentBriefPanel brief={brief} />
			<AgentBriefSheets brief={brief} briefShown onOpenBrief={() => undefined} />
		</>
	);
}

/** Copy for agent on the Walkthrough tab: the Agent brief panel is not on screen. */
function WalkthroughHarness({ onOpenBrief }: { onOpenBrief: () => void }) {
	const brief = useAgentBrief("/scratch/one");
	return (
		<>
			<CopyForAgentButton brief={brief} />
			<AgentBriefSheets brief={brief} briefShown={false} onOpenBrief={onOpenBrief} />
		</>
	);
}

const saved: AgentBrief = {
	version: 1,
	title: "Publish button does nothing",
	requestedChange: { text: "Make Publish complete the post", sourceIds: ["2"] },
	observed: { text: "Clicking Publish leaves status at Draft", sourceIds: ["2"] },
	evidence: [
		{ sourceId: "1", ts: 12_000, text: "Draft selected" },
		{ sourceId: "2", ts: 31_000, text: "Publish clicked; status unchanged" },
	],
	unknowns: ["Whether a network request was sent"],
	provider: "openrouter",
	model: "fake/model",
	sourceRevision: "abc",
	madeAt: 1,
};
const base: AgentBriefStatus = {
	connected: true,
	model: "fake/model",
	reviewed: true,
	alwaysSend: true,
	options: { transcript: true, frames: true },
	state: "none",
};
const payload: AgentBriefPreview = {
	token: "brief-token",
	provider: "openrouter",
	model: "fake/model",
	wordCount: 4,
	transcript: [{ startMs: 31_000, text: "Publish does nothing here" }],
	frames: [],
	steps: [{ sourceId: "1", ts: 12_000, label: "Select the draft" }],
	options: { transcript: true, frames: true },
};

const calls: string[] = [];
const status = vi.fn<(bundleDir: string) => Promise<AgentBriefStatus>>();
const preview = vi.fn();
const consent = vi.fn();
const run = vi.fn<(bundleDir: string, token: string) => Promise<AgentBriefRunResult>>();
const cancel = vi.fn();
const copy = vi.fn();
let current: AgentBriefStatus = base;
let settled: ((event: { bundleDir: string }) => void) | undefined;
let progress: ((event: { bundleDir: string; phase: "reading" }) => void) | undefined;

beforeEach(() => {
	vi.clearAllMocks();
	calls.length = 0;
	current = base;
	status.mockImplementation(async () => {
		calls.push("status");
		return current;
	});
	preview.mockImplementation(async () => {
		calls.push("preview");
		return payload;
	});
	consent.mockImplementation(async () => {
		calls.push("consent");
		return { success: true };
	});
	run.mockImplementation(async () => {
		calls.push("run");
		current = { ...base, state: "ready", brief: saved };
		return { success: true };
	});
	cancel.mockResolvedValue({ success: true });
	copy.mockImplementation(async () => {
		calls.push("copy");
		return { success: true };
	});
	Object.defineProperty(window, "electronAPI", {
		configurable: true,
		value: {
			showhowAgentBriefStatus: status,
			showhowAgentBriefPreview: preview,
			showhowAgentBriefConsent: consent,
			showhowAgentBriefRun: run,
			showhowAgentBriefCancel: cancel,
			showhowAgentBriefCopy: copy,
			showhowOnAgentBriefProgress: (
				callback: (event: { bundleDir: string; phase: "reading" }) => void,
			) => {
				progress = callback;
				return () => undefined;
			},
			showhowOnAgentBriefSettled: (callback: (event: { bundleDir: string }) => void) => {
				settled = callback;
				return () => undefined;
			},
		},
	});
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const copyButton = () =>
	screen.getByRole("button", { name: /copy for agent|making brief|copied/i });

describe("Copy for agent", () => {
	it("makes an absent brief first, then copies it, then shows copied feedback", async () => {
		render(<Harness bundleDir="/scratch/one" />);
		await screen.findByRole("heading", { name: "Make a brief for your agent" });
		Object.defineProperty(copyButton(), "offsetWidth", { configurable: true, value: 148 });
		await userEvent.click(copyButton());
		await screen.findByRole("button", { name: "Copied ✓" });
		expect(calls.filter((c) => c !== "status")).toEqual(["preview", "run", "copy"]);
		expect(copy).toHaveBeenCalledWith("/scratch/one");
		expect(copyButton()).toHaveStyle({ minWidth: "148px" });
		expect(screen.getByText("Brief + path on your clipboard")).toBeInTheDocument();
		expect(screen.getByText("Clicking Publish leaves status at Draft")).toBeInTheDocument();
	});

	it("resets the copied label after two seconds", async () => {
		current = { ...base, state: "ready", brief: saved };
		render(<Harness bundleDir="/scratch/one" />);
		await screen.findByText("Clicking Publish leaves status at Draft");
		vi.useFakeTimers({ shouldAdvanceTime: true });
		await userEvent.click(copyButton());
		await screen.findByRole("button", { name: "Copied ✓" });
		expect(run).not.toHaveBeenCalled();
		await act(async () => {
			vi.advanceTimersByTime(2000);
		});
		expect(copyButton()).toHaveAccessibleName("Copy for agent");
	});

	it("asks for a review of the brief payload before the first send", async () => {
		current = { ...base, reviewed: false, alwaysSend: false };
		render(<Harness bundleDir="/scratch/one" />);
		await userEvent.click(await screen.findByRole("button", { name: "Copy for agent" }));
		const dialog = await screen.findByRole("dialog", { name: "Check what's sent" });
		expect(dialog).toHaveTextContent("OpenRouter · fake/model");
		expect(run).not.toHaveBeenCalled();
		await userEvent.click(screen.getByRole("button", { name: "Make brief and copy" }));
		await screen.findByRole("button", { name: "Copied ✓" });
		expect(calls.filter((c) => c !== "status")).toEqual(["preview", "consent", "run", "copy"]);
		expect(consent).toHaveBeenCalledWith("/scratch/one", "brief-token", false);
	});

	it("sends the latest reviewed preview when option changes resolve out of order", async () => {
		current = { ...base, reviewed: false, alwaysSend: false };
		render(<Harness bundleDir="/scratch/one" />);
		await userEvent.click(await screen.findByRole("button", { name: "Make brief" }));
		await screen.findByRole("dialog", { name: "Check what's sent" });
		let slow!: (value: AgentBriefPreview) => void;
		preview
			.mockImplementationOnce(() => new Promise((resolve) => (slow = resolve)))
			.mockImplementationOnce(async () => ({ ...payload, token: "latest" }));
		await userEvent.click(screen.getByRole("checkbox", { name: "Send transcript" }));
		await userEvent.click(screen.getByRole("checkbox", { name: "Send transcript" }));
		await waitFor(() => expect(screen.getByRole("button", { name: "Make brief" })).toBeEnabled());
		await act(async () => slow({ ...payload, token: "stale" }));
		await userEvent.click(screen.getByRole("button", { name: "Make brief" }));
		await waitFor(() => expect(run).toHaveBeenCalledWith("/scratch/one", "latest"));
	});

	it("opens the connect sheet when no provider is connected", async () => {
		current = { ...base, connected: false };
		render(<Harness bundleDir="/scratch/one" />);
		await userEvent.click(await screen.findByRole("button", { name: "Copy for agent" }));
		expect(await screen.findByRole("button", { name: "Connect OpenRouter" })).toBeVisible();
		expect(preview).not.toHaveBeenCalled();
	});

	it.each([
		["provider", "Provider connection lost"],
		["invalid", "Response couldn't be validated"],
	])("does not copy or show copied after a %s failure", async (error, message) => {
		run.mockResolvedValueOnce({ success: false, error });
		render(<Harness bundleDir="/scratch/one" />);
		await userEvent.click(await screen.findByRole("button", { name: "Copy for agent" }));
		expect(await screen.findByRole("heading", { name: "Couldn't make the brief" })).toBeVisible();
		expect(screen.getByText(message)).toBeVisible();
		expect(copy).not.toHaveBeenCalled();
		expect(screen.queryByText("Copied ✓")).not.toBeInTheDocument();
	});

	it("reports a clipboard rejection without copied feedback", async () => {
		current = { ...base, state: "ready", brief: saved };
		copy.mockResolvedValueOnce({ success: false, reason: "error" });
		render(<Harness bundleDir="/scratch/one" />);
		await screen.findByText("Clicking Publish leaves status at Draft");
		await userEvent.click(copyButton());
		expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't copy");
		expect(screen.queryByText("Copied ✓")).not.toBeInTheDocument();
	});

	it("cancels a running brief and returns to not made without copying", async () => {
		let finish!: (result: AgentBriefRunResult) => void;
		run.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
		render(<Harness bundleDir="/scratch/one" />);
		await userEvent.click(await screen.findByRole("button", { name: "Copy for agent" }));
		expect(await screen.findByRole("heading", { name: "Making your brief" })).toBeVisible();
		expect(copyButton()).toHaveAccessibleName("Making brief…");
		expect(copyButton()).toHaveAttribute("aria-disabled", "true");
		await userEvent.click(copyButton());
		expect(preview).toHaveBeenCalledTimes(1);
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(cancel).toHaveBeenCalledWith("/scratch/one");
		await act(async () => finish({ success: false, cancelled: true }));
		expect(
			await screen.findByRole("heading", { name: "Make a brief for your agent" }),
		).toBeVisible();
		expect(copy).not.toHaveBeenCalled();
	});

	it("keeps a cancel pressed while consent is saving and never starts the run", async () => {
		current = { ...base, reviewed: false, alwaysSend: false };
		let saved!: (value: { success: boolean }) => void;
		consent.mockImplementationOnce(() => new Promise((resolve) => (saved = resolve)));
		render(<Harness bundleDir="/scratch/one" />);
		await userEvent.click(await screen.findByRole("button", { name: "Make brief" }));
		await screen.findByRole("dialog", { name: "Check what's sent" });
		await userEvent.click(screen.getByRole("button", { name: "Make brief" }));
		await screen.findByRole("heading", { name: "Making your brief" });
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await act(async () => saved({ success: true }));
		expect(
			await screen.findByRole("heading", { name: "Make a brief for your agent" }),
		).toBeVisible();
		expect(run).not.toHaveBeenCalled();
	});

	it("resends a cancel main refused because the run had not reached it yet", async () => {
		let finish!: (result: AgentBriefRunResult) => void;
		run.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
		cancel.mockResolvedValueOnce({ success: false });
		render(<Harness bundleDir="/scratch/one" />);
		await userEvent.click(await screen.findByRole("button", { name: "Make brief" }));
		await screen.findByRole("heading", { name: "Making your brief" });
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
		await act(async () => progress?.({ bundleDir: "/scratch/one", phase: "reading" }));
		expect(cancel).toHaveBeenCalledTimes(2);
		await act(async () => progress?.({ bundleDir: "/scratch/one", phase: "reading" }));
		expect(cancel).toHaveBeenCalledTimes(2);
		await act(async () => finish({ success: false, cancelled: true }));
		expect(
			await screen.findByRole("heading", { name: "Make a brief for your agent" }),
		).toBeVisible();
	});

	it("copies exactly once when main reports the run settled while this view awaits it", async () => {
		let finish!: (result: AgentBriefRunResult) => void;
		run.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
		render(<Harness bundleDir="/scratch/one" />);
		await userEvent.click(await screen.findByRole("button", { name: "Copy for agent" }));
		await screen.findByRole("heading", { name: "Making your brief" });
		current = { ...base, state: "ready", brief: saved };
		await act(async () => settled?.({ bundleDir: "/scratch/one" }));
		expect(copyButton()).toHaveAccessibleName("Making brief…");
		await act(async () => finish({ success: true }));
		await screen.findByRole("button", { name: "Copied ✓" });
		expect(copy).toHaveBeenCalledTimes(1);
	});

	it("shows a failed re-preview in the review sheet and retries it", async () => {
		current = { ...base, reviewed: false, alwaysSend: false };
		render(<Harness bundleDir="/scratch/one" />);
		await userEvent.click(await screen.findByRole("button", { name: "Make brief" }));
		const dialog = await screen.findByRole("dialog", { name: "Check what's sent" });
		preview.mockRejectedValueOnce(new Error("busy"));
		await userEvent.click(screen.getByRole("checkbox", { name: "Send transcript" }));
		expect(await screen.findByText("Couldn't read the recording folder")).toBeVisible();
		const make = () =>
			Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Make brief")!;
		expect(make()).toBeDisabled();
		await userEvent.click(screen.getByRole("button", { name: "Try again" }));
		await waitFor(() => expect(make()).toBeEnabled());
		expect(preview).toHaveBeenLastCalledWith("/scratch/one", { transcript: false, frames: true });
		expect(screen.queryByText("Couldn't read the recording folder")).not.toBeInTheDocument();
	});

	it("ignores a result that lands after another recording is selected", async () => {
		let finish!: (result: AgentBriefRunResult) => void;
		run.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
		const view = render(<Harness key="one" bundleDir="/scratch/one" />);
		await userEvent.click(await screen.findByRole("button", { name: "Copy for agent" }));
		await screen.findByRole("heading", { name: "Making your brief" });
		view.rerender(
			<I18nProvider>
				<Harness key="two" bundleDir="/scratch/two" />
			</I18nProvider>,
		);
		await act(async () => finish({ success: true }));
		await waitFor(() => expect(status).toHaveBeenCalledWith("/scratch/two"));
		expect(copy).not.toHaveBeenCalled();
		expect(screen.queryByText("Copied ✓")).not.toBeInTheDocument();
	});

	it("keeps showing the previous brief after a failed remake", async () => {
		current = { ...base, state: "ready", brief: saved };
		run.mockImplementationOnce(async () => {
			current = { ...base, state: "failed", error: "provider", brief: saved };
			return { success: false, error: "provider" };
		});
		render(<Harness bundleDir="/scratch/one" />);
		await userEvent.click(await screen.findByRole("button", { name: "Remake brief" }));
		expect(await screen.findByRole("heading", { name: "Couldn't make the brief" })).toBeVisible();
		expect(screen.getByText("Your previous brief is unchanged.")).toBeVisible();
		expect(screen.getByText("Clicking Publish leaves status at Draft")).toBeVisible();
	});
});

describe("#202 failure feedback away from the Agent brief tab", () => {
	it("toasts a brief that could not be prepared, links to the tab and closes on request", async () => {
		const openBrief = vi.fn();
		preview.mockRejectedValueOnce(new Error("folder unreadable"));
		render(<WalkthroughHarness onOpenBrief={openBrief} />);
		await userEvent.click(await screen.findByRole("button", { name: "Copy for agent" }));
		const toast = await screen.findByRole("alert");
		expect(toast).toHaveTextContent("Couldn't make the brief");
		expect(copyButton()).toHaveAccessibleName("Copy for agent");
		expect(copy).not.toHaveBeenCalled();

		await userEvent.click(within(toast).getByRole("button", { name: "Open Agent brief" }));
		expect(openBrief).toHaveBeenCalledTimes(1);
		await userEvent.click(within(toast).getByRole("button", { name: "Close notification" }));
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("toasts a consent that could not be saved from the review sheet", async () => {
		current = { ...base, reviewed: false, alwaysSend: false };
		consent.mockResolvedValueOnce({ success: false });
		render(<WalkthroughHarness onOpenBrief={() => undefined} />);
		await userEvent.click(await screen.findByRole("button", { name: "Copy for agent" }));
		await userEvent.click(await screen.findByRole("button", { name: "Make brief and copy" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't make the brief");
		expect(run).not.toHaveBeenCalled();
	});

	it("does not toast a cancelled run", async () => {
		run.mockResolvedValueOnce({ success: false, cancelled: true });
		render(<WalkthroughHarness onOpenBrief={() => undefined} />);
		await userEvent.click(await screen.findByRole("button", { name: "Copy for agent" }));
		await waitFor(() => expect(run).toHaveBeenCalled());
		await waitFor(() => expect(copyButton()).toHaveAccessibleName("Copy for agent"));
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("clears the toast when Copy for agent is pressed again", async () => {
		run.mockResolvedValueOnce({ success: false, error: "provider" });
		render(<WalkthroughHarness onOpenBrief={() => undefined} />);
		await userEvent.click(await screen.findByRole("button", { name: "Copy for agent" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't make the brief");
		await userEvent.click(copyButton());
		await screen.findByRole("button", { name: "Copied ✓" });
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(screen.getByText("Brief + path on your clipboard")).toBeInTheDocument();
	});
});

describe("Agent brief states", () => {
	it("renders a ready brief with evidence times and explicit unknowns", async () => {
		current = { ...base, state: "ready", brief: saved };
		render(<Harness bundleDir="/scratch/one" />);
		expect(await screen.findByText("Requested change")).toBeVisible();
		expect(screen.queryByText("Expected result")).not.toBeInTheDocument();
		expect(screen.getByText("0:31")).toBeVisible();
		expect(screen.getByText("Whether a network request was sent")).toBeVisible();
		expect(
			screen.getByText(
				"Copy includes the brief and the local bundle path. Give your agent access to that folder.",
			),
		).toBeVisible();
	});

	it("settles a run that finished while this recording's view was away", async () => {
		current = { ...base, state: "making", phase: "writing" };
		render(<Harness bundleDir="/scratch/one" />);
		await screen.findByRole("heading", { name: "Making your brief" });
		current = { ...base, state: "ready", brief: saved };
		await act(async () => settled?.({ bundleDir: "/scratch/two" }));
		expect(screen.getByRole("heading", { name: "Making your brief" })).toBeVisible();
		await act(async () => settled?.({ bundleDir: "/scratch/one" }));
		expect(await screen.findByText("Clicking Publish leaves status at Draft")).toBeVisible();
		expect(screen.queryByRole("heading", { name: "Making your brief" })).not.toBeInTheDocument();
	});

	it("keeps the settled state when the first status reply arrives late", async () => {
		let first!: (value: AgentBriefStatus) => void;
		status.mockImplementationOnce(() => new Promise((resolve) => (first = resolve)));
		render(<Harness bundleDir="/scratch/one" />);
		current = { ...base, state: "ready", brief: saved };
		await act(async () => settled?.({ bundleDir: "/scratch/one" }));
		expect(await screen.findByText("Clicking Publish leaves status at Draft")).toBeVisible();
		await act(async () => first({ ...base, state: "making", phase: "writing" }));
		expect(screen.queryByRole("heading", { name: "Making your brief" })).not.toBeInTheDocument();
	});

	it("reports a failed save at the evidence step with its own message", async () => {
		run.mockResolvedValueOnce({ success: false, error: "save" });
		render(<Harness bundleDir="/scratch/one" />);
		await userEvent.click(await screen.findByRole("button", { name: "Make brief" }));
		expect(await screen.findByText("Couldn't save the brief")).toBeVisible();
		expect(screen.queryByText("Couldn't read the recording folder")).not.toBeInTheDocument();
	});

	it("shows a run already making in main as making", async () => {
		current = { ...base, state: "making", phase: "writing" };
		render(<Harness bundleDir="/scratch/one" />);
		expect(await screen.findByText("Step 2 of 3")).toBeVisible();
	});
});

describe("#200 no clicks or speech", () => {
	const body =
		"This recording has no clicks or speech. Record again with the microphone on, or narrate while you click.";
	it("shows the empty state and hides Copy for agent, Make brief and Check what's sent", async () => {
		current = { ...base, noInput: true };
		render(<Harness bundleDir="/scratch/one" />);
		expect(
			await screen.findByRole("heading", { name: "Nothing to turn into a brief" }),
		).toBeVisible();
		expect(screen.getByText(body)).toBeVisible();
		expect(screen.queryByRole("button", { name: /copy for agent/i })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Make brief" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Check what's sent" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
		expect(preview).not.toHaveBeenCalled();
		expect(run).not.toHaveBeenCalled();
	});
	it("shows the empty state, not the validation error, for a failure recorded before this fix", async () => {
		current = { ...base, noInput: true, state: "failed", error: "invalid" };
		render(<Harness bundleDir="/scratch/one" />);
		expect(
			await screen.findByRole("heading", { name: "Nothing to turn into a brief" }),
		).toBeVisible();
		expect(screen.queryByText("Response couldn't be validated")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: "Couldn't make the brief" }),
		).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
	});
	it("review sheet does not allow sending 0 words and 0 frames", async () => {
		current = { ...base, reviewed: false, alwaysSend: false };
		preview.mockImplementation(async () => {
			calls.push("preview");
			return { ...payload, wordCount: 0, transcript: [], frames: [], steps: [] };
		});
		render(<Harness bundleDir="/scratch/one" />);
		await userEvent.click(await screen.findByRole("button", { name: "Make brief" }));
		const dialog = await screen.findByRole("dialog", { name: "Check what's sent" });
		expect(within(dialog).getByText("Transcript · 0 words")).toBeVisible();
		expect(within(dialog).getByText("Frames · 0 selected")).toBeVisible();
		expect(
			within(dialog).getByText(
				"This recording has no clicks or speech, so there is nothing to send.",
			),
		).toBeVisible();
		expect(within(dialog).getByRole("button", { name: "Make brief" })).toBeDisabled();
		expect(run).not.toHaveBeenCalled();
		expect(consent).not.toHaveBeenCalled();
	});
});
