const replaying = new WeakSet<HTMLElement>();

export function isReplayingClick(target: HTMLElement): boolean {
	return replaying.has(target);
}

export async function deferMutableClick(
	event: MouseEvent,
	target: HTMLInputElement,
	capture: () => Promise<void>,
): Promise<void> {
	event.preventDefault();
	await capture();
	replaying.add(target);
	try {
		target.click();
	} finally {
		replaying.delete(target);
	}
}
