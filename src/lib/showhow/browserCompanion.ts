import { computeAccessibleName } from "dom-accessibility-api";

export interface CompanionStep {
	ts: number;
	label: string;
	cx: number;
	cy: number;
	redacted: boolean;
	screenshot: string | null;
}

export interface BrowserCompanionCaptureOptions {
	sendStep: (step: CompanionStep) => Promise<void>;
	captureScreenshot: () => Promise<string | null>;
	now: () => number;
	getUrl: () => string;
}

interface CompanionPointerEvent {
	target: EventTarget | null;
	clientX?: number;
	clientY?: number;
	view?: Window | null;
}

/**
 * Page-side capture policy for the browser companion. It intentionally has no
 * recording controls: desktop ownership is represented by the bridge epoch,
 * while this module only produces safe semantic steps for a paired transport.
 */
export class BrowserCompanionCapture {
	constructor(private readonly options: BrowserCompanionCaptureOptions) {}

	async captureClick(event: CompanionPointerEvent): Promise<void> {
		const target = interactiveTarget(event.target);
		if (!target) return;
		await this.captureAction("Click", target, event, false, true);
	}

	async captureInput(event: CompanionPointerEvent): Promise<void> {
		const target = inputTarget(event.target);
		if (!target) return;
		// Typed values are never read or placed in a step. The persisted redaction
		// flag makes the safe representation explicit at every later layer.
		await this.captureAction("Type", target, event, true, false);
	}

	async captureNavigation(): Promise<void> {
		const url = new URL(this.options.getUrl());
		await this.options.sendStep({
			ts: this.options.now(),
			label: `Navigate to ${url.pathname}${url.search}${url.hash}`,
			cx: 0,
			cy: 0,
			redacted: false,
			screenshot: null,
		});
	}

	private async captureAction(
		verb: "Click" | "Type",
		target: HTMLElement,
		event: CompanionPointerEvent,
		redacted: boolean,
		captureScreenshot: boolean,
	): Promise<void> {
		const name = computeAccessibleName(target).trim();
		if (!name) return;
		// Ask the privileged service worker before the page action has propagated.
		const screenshot = captureScreenshot ? await this.options.captureScreenshot() : null;
		await this.options.sendStep({
			ts: this.options.now(),
			label: `${verb} ${name}`,
			cx: clampCoordinate(event.clientX ?? 0, (event.view ?? window).innerWidth),
			cy: clampCoordinate(event.clientY ?? 0, (event.view ?? window).innerHeight),
			redacted,
			screenshot,
		});
	}
}

function interactiveTarget(target: EventTarget | null): HTMLElement | null {
	if (!(target instanceof HTMLElement)) return null;
	return target.closest<HTMLElement>(
		'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="menuitem"], [contenteditable="true"]',
	);
}

function inputTarget(target: EventTarget | null): HTMLElement | null {
	if (!(target instanceof HTMLElement)) return null;
	return target.closest<HTMLElement>(
		'input:not([type="hidden"]), textarea, select, [contenteditable="true"]',
	);
}

function clampCoordinate(value: number, size: number): number {
	if (!Number.isFinite(value) || !Number.isFinite(size) || size <= 0) return 0;
	return Math.min(1, Math.max(0, value / size));
}
