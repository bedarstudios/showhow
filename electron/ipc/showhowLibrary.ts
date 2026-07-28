export interface ClipboardWriter {
	writeText(text: string): void;
}

export function copyShowhowBundlePath(
	clipboard: ClipboardWriter,
	bundleDir: string,
): { success: boolean } {
	clipboard.writeText(bundleDir);
	return { success: true };
}
