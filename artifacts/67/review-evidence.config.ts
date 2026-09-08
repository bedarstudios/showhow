import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineBrowserCommand } from "@vitest/browser";
import { mergeConfig } from "vitest/config";
import config from "../../vitest.browser.config";

const evidenceDirectory = process.env.MP4_CI_PHASE_DIR ?? import.meta.dirname;

function writeEvidence(target: string, data: string | Buffer) {
	if (process.env.MP4_CI_PHASE_DIR) {
		const base = path.join(import.meta.dirname, "ci-validation");
		if (path.dirname(evidenceDirectory) !== base) throw new Error("Invalid CI evidence directory");
		const bytes = (directory: string): number =>
			readdirSync(directory).reduce((total, name) => {
				const child = path.join(directory, name);
				const info = statSync(child);
				return total + (info.isDirectory() ? bytes(child) : info.size);
			}, 0);
		if (bytes(base) + Buffer.byteLength(data) >= 2 * 1024 ** 2 - 65536)
			throw new Error("CI evidence exceeds 2MiB budget");
	}
	writeFileSync(target, data);
}

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
							!/^(paired|oracle-(6|18|15|45)|quality-\d+-(6|18|15|45))$/.test(name) ||
							measurement.length > 16000
						) {
							throw new Error("Review measurement budget exceeded");
						}
						const parsed: unknown = JSON.parse(measurement);
						let target = path.join(evidenceDirectory, `review-${name}.json`);
						let counter = 1;
						while (existsSync(target))
							target = path.join(evidenceDirectory, `review-${name}-${counter++}.json`);
						writeEvidence(target, `${JSON.stringify(parsed, null, "\t")}\n`);
					},
				),
				recordMp4Quality: defineBrowserCommand<[string, string]>(async (_context, name, png) => {
					// CI keeps final GREEN crops only; all phases retain measurements.
					if (process.env.MP4_CI_PHASE_DIR && path.basename(evidenceDirectory) !== "green-quality")
						return;
					if (
						!/^(reference|decoded|blurred|control)-(6|18|15|45)$/.test(name) ||
						png.length > 200_000
					) {
						throw new Error("4K evidence budget exceeded");
					}
					let target = path.join(evidenceDirectory, `review-4k-${name}.png`);
					let counter = 1;
					while (existsSync(target)) {
						target = path.join(evidenceDirectory, `review-4k-${name}-${counter++}.png`);
					}
					writeEvidence(target, Buffer.from(png, "base64"));
				}),
			},
		},
	},
});
