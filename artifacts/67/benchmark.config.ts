import { appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineBrowserCommand } from "@vitest/browser";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
	root,
	// Never put benchmark caches in the shared node_modules symlink.
	cacheDir: path.join(root, "artifacts/67/.vite-cache"),
	test: {
		include: ["src/lib/exporter/*.browser.test.ts"],
		browser: {
			commands: {
				recordMp4Measurement: defineBrowserCommand<[string, string, string]>(
					async (_context, name, measurement, frame) => {
						if (!/^(static|scroll|motion)-\d+$/.test(name))
							throw new Error("Invalid evidence name");
						if (measurement.length > 4000 || frame.length > 2_000_000)
							throw new Error("Evidence budget exceeded");
						appendFileSync(path.join(root, "artifacts/67/measurements.jsonl"), `${measurement}\n`);
						writeFileSync(
							path.join(root, `artifacts/67/${name}.png`),
							Buffer.from(frame, "base64"),
						);
					},
				),
			},
			enabled: true,
			provider: playwright({ launchOptions: { args: ["--use-angle=metal"] } }),
			headless: true,
			instances: [{ browser: "chromium" }],
		},
		testTimeout: 180_000,
		hookTimeout: 30_000,
	},
	resolve: { alias: { "@": path.join(root, "src") } },
});
