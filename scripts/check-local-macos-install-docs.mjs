import fs from "node:fs/promises";
import path from "node:path";

const documentationPath = path.join(process.cwd(), "CONTRIBUTING.md");
const documentation = await fs.readFile(documentationPath, "utf8");
const legacyProjectExtension = `.${["open", "screen"].join("")}`;
const requiredSnippets = [
	"## Local macOS desktop build",
	"npm run build:mac",
	"## Install and launch",
	"`/Applications/Showhow.app`",
	"## Replace a local installation",
	"`~/Showhow/Recordings`",
	"`.showhow` and `" + legacyProjectExtension + "`",
	"outside the app bundle",
	"not notarized",
	"Screen Recording",
	"Accessibility",
	"identity",
	"## Remove a local installation",
	"share the same user-data profile",
	"quit development and all other Showhow processes",
	'case "$(uname -m)" in',
	'arm64) APP_BUNDLE="release/$VERSION/mac-arm64/Showhow.app"',
	'x86_64) APP_BUNDLE="release/$VERSION/mac/Showhow.app"',
	"Unsupported macOS host architecture",
	'sudo ditto "$APP_BUNDLE" /Applications/Showhow.app',
];

const missing = requiredSnippets.filter((snippet) => !documentation.includes(snippet));
const installSection = documentation.slice(
	documentation.indexOf("## Install and launch"),
	documentation.indexOf("## Replace a local installation"),
);
const disallowedInstallSnippets = [
	'find "release/$VERSION"',
	"sudo rm -rf /Applications/Showhow.app",
];
const forbidden = disallowedInstallSnippets.filter((snippet) => installSection.includes(snippet));
const obsolete = ["Development runs intentionally use their own user-data directory"].filter(
	(snippet) => documentation.includes(snippet),
);

if (missing.length > 0 || forbidden.length > 0 || obsolete.length > 0) {
	console.error("CONTRIBUTING.md is missing local macOS installation guidance:");
	for (const snippet of missing) console.error(`- ${snippet}`);
	for (const snippet of forbidden) console.error(`- remove obsolete guidance: ${snippet}`);
	for (const snippet of obsolete) console.error(`- remove false guidance: ${snippet}`);
	process.exitCode = 1;
} else {
	console.log("Local macOS installation documentation check passed.");
}
