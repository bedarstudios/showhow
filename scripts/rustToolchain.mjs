import { accessSync, constants } from "node:fs";
import os from "node:os";
import path from "node:path";

function isExecutable(file) {
	try {
		accessSync(file, process.platform === "win32" ? constants.F_OK : constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

export function resolveRustTool(name, env = process.env, home = os.homedir()) {
	const executable = process.platform === "win32" ? `${name}.exe` : name;
	const onPath = env.PATH?.split(path.delimiter)
		.map((directory) => path.resolve(directory, executable))
		.find(isExecutable);
	if (onPath) return onPath;

	const fallback = path.join(home, ".cargo", "bin", executable);
	return isExecutable(fallback) ? fallback : undefined;
}

export function windowsCargoBuildCommand(cargoExe) {
	return `"${cargoExe.replaceAll("%", "%%")}" build -p compositor-view-napi --release`;
}
