import { realpathSync } from "node:fs";
import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
	// Keep generated caches out of node_modules when dependencies are shared.
	cacheDir: path.resolve(__dirname, ".vitest-cache/browser"),
	optimizeDeps: {
		entries: ["src/**/*.browser.test.{ts,tsx}"],
		include: ["gif.js"],
	},
	server: {
		fs: {
			allow: [__dirname, realpathSync(path.resolve(__dirname, "node_modules/gif.js/dist"))],
		},
	},
	test: {
		include: ["src/**/*.browser.test.{ts,tsx}"],
		// Real software encoders compete for the small Linux CI runner's resources.
		fileParallelism: false,
		browser: {
			enabled: true,
			provider: playwright({
				launchOptions: {
					args:
						process.platform === "darwin"
							? ["--use-angle=metal"]
							: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
				},
			}),
			headless: true,
			instances: [{ browser: "chromium" }],
		},
		testTimeout: 120_000,
		hookTimeout: 30_000,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
	assetsInclude: ["**/*.webm"],
});
