import { readFileSync } from "node:fs";
import path from "node:path";
import { mergeConfig } from "vitest/config";
import config from "../../vitest.browser.config";

const settingsPath = path.resolve(
	import.meta.dirname,
	"../../src/lib/exporter/mp4ExportSettings.ts",
);

// Inject the genuine pre-fix module into this test server only. Production
// files remain byte-identical even if the test process is killed abruptly.
export default mergeConfig(config, {
	cacheDir: path.join(import.meta.dirname, ".vite-cache"),
	plugins: [
		{
			name: "mp4-legacy-settings-red",
			enforce: "pre",
			load(id) {
				if (id.split("?")[0] === settingsPath) {
					return readFileSync(path.join(import.meta.dirname, "legacy-settings.red.txt"), "utf8");
				}
			},
		},
	],
});
