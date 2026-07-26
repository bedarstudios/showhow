// Reproduce before.txt / generate after.txt from the issue #32 fixture.
// Run with: node --import tsx artifacts/32/generate.mjs
// (or: npx tsx artifacts/32/generate.mjs)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAutoZoomSuggestions } from "../../src/components/video-editor/timeline/zoomSuggestionUtils.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(
	__dirname,
	"../../src/components/video-editor/timeline/__fixtures__/issue32-cursor.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const samples = fixture.samples;
const totalMs = fixture.durationMs;

// Match the before.txt artifact's span width (1333ms) so after.txt is directly
// comparable. before.txt was generated with this fixed default duration.
const defaultDurationMs = 1333;

const CLICK_TYPES = new Set(["click", "double-click", "right-click", "middle-click"]);
const clicks = samples.filter((s) => CLICK_TYPES.has(s.interactionType));

const suggestions = buildAutoZoomSuggestions({
	cursorTelemetry: samples,
	totalMs,
	existingRegions: [],
	defaultDurationMs,
});

const sorted = [...suggestions].sort((a, b) => a.span.start - b.span.start);
const lines = [];
let covering = 0;
for (const s of sorted) {
	const hit = clicks.some((c) => c.timeMs >= s.span.start && c.timeMs < s.span.end);
	if (hit) covering += 1;
	const focus = `(${s.focus.cx.toFixed(3)},${s.focus.cy.toFixed(3)})`;
	lines.push(
		`  ${Math.round(s.span.start)}-${Math.round(s.span.end)} focus=${focus} ${hit ? "HIT" : "NO CLICK"}`,
	);
}

const header = `clicks=${clicks.length} spans=${suggestions.length} covering=${covering}`;
const out = [header, ...lines].join("\n") + "\n";

const outPath = path.resolve(__dirname, process.argv[2] ?? "after.txt");
writeFileSync(outPath, out);
console.log(`Wrote ${outPath}`);
console.log(out);
