import { build } from "esbuild";

await build({
	entryPoints: {
		"content-script": "src/lib/showhow/companion/contentScript.ts",
		"service-worker": "src/lib/showhow/companion/serviceWorker.ts",
	},
	bundle: true,
	format: "esm",
	target: "chrome120",
	outdir: "browser-companion/dist",
});
