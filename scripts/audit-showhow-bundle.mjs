import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditBundle } from "../electron/showhow/bundleAudit.ts";

function usage() {
	return "Usage: npm run audit:showhow-bundle -- <bundle-path> [--output <report.json>]";
}

function parseArguments(args) {
	let bundlePath;
	let outputPath;

	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--help" || argument === "-h") {
			return { help: true };
		}
		if (argument === "--output") {
			outputPath = args[index + 1];
			index += 1;
			continue;
		}
		if (bundlePath === undefined) {
			bundlePath = argument;
			continue;
		}
		throw new Error(`Unexpected argument: ${argument}`);
	}

	if (bundlePath === undefined) throw new Error(usage());
	if (outputPath === undefined) return { bundlePath };
	return { bundlePath, outputPath };
}

try {
	const options = parseArguments(process.argv.slice(2));
	if (options.help) {
		console.log(usage());
	} else {
		const report = await auditBundle(path.resolve(options.bundlePath));
		const output = `${JSON.stringify(report, null, "\t")}\n`;
		if (options.outputPath !== undefined) {
			const outputPath = path.resolve(options.outputPath);
			await mkdir(path.dirname(outputPath), { recursive: true });
			await writeFile(outputPath, output);
		}
		console.log(output);
		process.exitCode = report.acceptancePassed ? 0 : 1;
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
