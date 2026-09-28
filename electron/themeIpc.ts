import type { IpcMain } from "electron";

interface ThemeWindow {
	isDestroyed(): boolean;
	webContents: { send(channel: string, ...args: unknown[]): void };
}

interface ThemeIpcDependencies {
	ipcMain: Pick<IpcMain, "handle">;
	windowRegistry(): ThemeWindow[];
	nativeTheme: {
		shouldUseDarkColors: boolean;
		on(event: "updated", callback: () => void): void;
	};
}

export function registerThemeIpc({ ipcMain, windowRegistry, nativeTheme }: ThemeIpcDependencies) {
	ipcMain.handle("showhow:get-system-theme", () => nativeTheme.shouldUseDarkColors);
	nativeTheme.on("updated", () => {
		const isDark = nativeTheme.shouldUseDarkColors;
		for (const window of windowRegistry()) {
			if (!window.isDestroyed()) {
				window.webContents.send("showhow:system-theme-changed", isDark);
			}
		}
	});
}
