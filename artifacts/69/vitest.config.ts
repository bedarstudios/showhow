import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Same test contract as the repository config, runnable without writing to
// shared node_modules or relying on the bundle loader's __dirname injection.
export default defineConfig({
	root: fileURLToPath(new URL("../../", import.meta.url)),
	cacheDir: ".local/issue-69/vitest-cache",
	test: {
		globals: true,
		environment: "jsdom",
		include: ["{src,electron,.github}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		exclude: ["src/**/*.browser.test.{ts,tsx}"],
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("../../src", import.meta.url)),
		},
	},
});
