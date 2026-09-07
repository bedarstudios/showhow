import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineBrowserCommand } from "@vitest/browser";
import { mergeConfig } from "vitest/config";
import config from "../../vitest.browser.config";

// The normal CI config, with a bounded visual-evidence sink only. No legacy
// module injection and no production/quality/size assertion overrides.
export default mergeConfig(config, {
	cacheDir: path.join(import.meta.dirname, ".vite-cache"),
	test: {
		browser: {
			commands: {
				recordMp4ReviewMeasurement: defineBrowserCommand<[string, string]>(
					async (_context, name, measurement) => {
						if (
							!/^(oracle-(15|45)|quality-\d+-(15|45))$/.test(name) ||
							measurement.length > 16000
						) {
							throw new Error("Review measurement budget exceeded");
						}
						const parsed: unknown = JSON.parse(measurement);
						let target = path.join(import.meta.dirname, `review-${name}.json`);
						let counter = 1;
						while (existsSync(target))
							target = path.join(import.meta.dirname, `review-${name}-${counter++}.json`);
						writeFileSync(target, `${JSON.stringify(parsed, null, "\t")}\n`);
					},
				),
				recordMp4Quality: defineBrowserCommand<[string, string]>(async (_context, name, png) => {
					if (!/^(reference|decoded|blurred|control)-(15|45)$/.test(name) || png.length > 200_000) {
						throw new Error("4K evidence budget exceeded");
					}
					let target = path.join(import.meta.dirname, `review-4k-${name}.png`);
					let counter = 1;
					while (existsSync(target)) {
						target = path.join(import.meta.dirname, `review-4k-${name}-${counter++}.png`);
					}
					writeFileSync(target, Buffer.from(png, "base64"));
				}),
			},
		},
	},
});
