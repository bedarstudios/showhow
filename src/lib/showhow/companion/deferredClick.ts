const replaying = new WeakSet<HTMLElement>();

// The capture path talks to a transport that can stall while disconnected, but
// the user's click must never be swallowed: after this budget the default
// action replays even if the capture promise has not settled.
const CAPTURE_REPLAY_TIMEOUT_MS = 1500;

export function isReplayingClick(target: HTMLElement): boolean {
	return replaying.has(target);
}

export async function deferMutableClick(
	event: MouseEvent,
	target: HTMLInputElement,
	capture: () => Promise<void>,
): Promise<void> {
	event.preventDefault();
	await Promise.race([
		capture().catch(() => undefined),
		new Promise<void>((resolve) => setTimeout(resolve, CAPTURE_REPLAY_TIMEOUT_MS)),
	]);
	replaying.add(target);
	try {
		target.click();
	} finally {
		replaying.delete(target);
	}
}
