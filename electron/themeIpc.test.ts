import { describe, expect, it, vi } from "vitest";
import { registerThemeIpc } from "./themeIpc";

describe("registerThemeIpc", () => {
	it("returns current system theme from the invoke handler", () => {
		const handlers = new Map<string, () => boolean>();
		const nativeTheme = { shouldUseDarkColors: false, on: vi.fn() };
		registerThemeIpc({
			ipcMain: { handle: (channel, handler) => handlers.set(channel, handler as () => boolean) },
			windowRegistry: () => [],
			nativeTheme,
		});
		expect(handlers.get("showhow:get-system-theme")?.()).toBe(false);
		nativeTheme.shouldUseDarkColors = true;
		expect(handlers.get("showhow:get-system-theme")?.()).toBe(true);
	});

	it("broadcasts updates to live windows and skips destroyed windows", () => {
		let updated: (() => void) | undefined;
		const liveSend = vi.fn();
		const destroyedSend = vi.fn();
		const nativeTheme = {
			shouldUseDarkColors: true,
			on: (_event: "updated", callback: () => void) => {
				updated = callback;
			},
		};
		registerThemeIpc({
			ipcMain: { handle: vi.fn() },
			windowRegistry: () => [
				{ isDestroyed: () => false, webContents: { send: liveSend } },
				{ isDestroyed: () => true, webContents: { send: destroyedSend } },
			],
			nativeTheme,
		});
		updated?.();
		expect(liveSend).toHaveBeenCalledOnce();
		expect(liveSend).toHaveBeenCalledWith("showhow:system-theme-changed", true);
		expect(destroyedSend).not.toHaveBeenCalled();
	});
});
