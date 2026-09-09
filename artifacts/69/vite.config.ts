import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

// Lane-local verification runtime; production app source and native startup are unchanged.
const root = fileURLToPath(new URL("../../", import.meta.url));
export default defineConfig({
	root,
	cacheDir: path.join(root, ".local/issue-69/vite-cache"),
	plugins: [
		react(),
		electron({
			main: {
				entry: "electron/bootstrap.ts",
				onstart({ startup }) {
					const env = { ...process.env };
					delete env.ELECTRON_RUN_AS_NODE;
					return startup(["."], { env });
				},
				vite: {
					build: {
						rollupOptions: {
							external: [
								// `ws` is a Node-only dependency of the desktop bridge. Its
								// optional native deps (`bufferutil`, `utf-8-validate`) are
								// `require()`d inside a try/catch so ws falls back to a pure-JS
								// implementation when they are absent. Bundling ws lets Vite
								// rewrite that `require()` into a top-level stub that throws
								// `Could not resolve "bufferutil" imported by "ws"` in the dev
								// bundle, crashing the Electron main at load. Externalizing ws
								// keeps the require a real runtime require inside ws's own
								// try/catch, so the localhost bridge loads without the native
								// helpers installed.
								"ws",
							],
							output: {
								entryFileNames: "main.js",
							},
						},
					},
				},
			},
			preload: {
				input: path.join(root, "electron/preload.ts"),
			},
			renderer: process.env.NODE_ENV === "test" ? undefined : {},
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(root, "src"),
			// @xenova/transformers: env.js statically imports fs/path/url; onnx.js imports
			// onnxruntime-node (must not be bundled in the renderer — it requires fs).
			fs: path.resolve(root, "src/lib/vite-stubs/empty-node-module.ts"),
			path: path.resolve(root, "src/lib/vite-stubs/empty-node-module.ts"),
			url: path.resolve(root, "src/lib/vite-stubs/empty-node-module.ts"),
			"onnxruntime-node": path.resolve(root, "src/lib/vite-stubs/onnxruntime-node-stub.ts"), // re-exports web ORT
		},
	},
	optimizeDeps: {
		esbuildOptions: { sourcemap: false, minify: true },
		exclude: ["@xenova/transformers"],
	},
	// The captioning worker dynamically imports @xenova/transformers, which makes the
	// worker bundle code-split — unsupported by the default "iife" worker format.
	worker: {
		format: "es",
	},
	build: {
		target: "esnext",
		minify: "terser",
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
				pure_funcs: ["console.log", "console.debug"],
			},
		},
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("pixi.js") || id.includes("pixi-filters") || id.includes("@pixi/"))
						return "pixi";
					if (id.includes("react-dom") || id.includes("/react/")) return "react-vendor";
					if (
						id.includes("mediabunny") ||
						id.includes("mp4box") ||
						id.includes("fix-webm-duration")
					)
						return "video-processing";
				},
			},
		},
		chunkSizeWarningLimit: 1000,
	},
});
