import path from "node:path";
import { pathToFileURL } from "node:url";

export const SHOWHOW_MEDIA_SCHEME = "showhow-media";

function assertSafeRelativePath(relativePath: string): void {
	if (
		relativePath.length === 0 ||
		path.isAbsolute(relativePath) ||
		relativePath.split(/[\\/]/u).some((segment) => segment === ".." || segment === ".")
	) {
		throw new Error("Unsafe Showhow media path");
	}
}

export function createShowhowMediaUrl(bundleDir: string, relativePath: string): string {
	assertSafeRelativePath(relativePath);
	const bundleName = path.basename(bundleDir);
	if (bundleName.length === 0 || bundleName === "." || bundleName === "..") {
		throw new Error("Unsafe Showhow bundle path");
	}
	return `${SHOWHOW_MEDIA_SCHEME}://recordings/${encodeURIComponent(bundleName)}/${relativePath
		.split(/[\\/]/u)
		.map((segment) => encodeURIComponent(segment))
		.join("/")}`;
}

export function resolveShowhowMediaPath(recordingsRoot: string, requestUrl: string): string | null {
	let url: URL;
	try {
		url = new URL(requestUrl);
	} catch {
		return null;
	}
	if (url.protocol !== `${SHOWHOW_MEDIA_SCHEME}:` || url.hostname !== "recordings") {
		return null;
	}
	const segments = url.pathname
		.split("/")
		.filter(Boolean)
		.map((segment) => decodeURIComponent(segment));
	if (segments.length < 2) {
		return null;
	}
	const [bundleName, ...relativeSegments] = segments;
	if (
		bundleName === undefined ||
		bundleName === "." ||
		bundleName === ".." ||
		relativeSegments.some((segment) => segment === "." || segment === "..")
	) {
		return null;
	}
	const resolvedRoot = path.resolve(recordingsRoot);
	const resolvedPath = path.resolve(resolvedRoot, bundleName, ...relativeSegments);
	return resolvedPath.startsWith(`${resolvedRoot}${path.sep}`) ? resolvedPath : null;
}

export type LocalMediaFetcher = (
	input: string,
	init: { headers: Record<string, string> },
) => Promise<Response>;

export function fetchShowhowMedia(
	recordingsRoot: string,
	request: Pick<Request, "headers" | "url">,
	fetchLocalFile: LocalMediaFetcher,
): Promise<Response> {
	const filePath = resolveShowhowMediaPath(recordingsRoot, request.url);
	if (!filePath) {
		return Promise.resolve(new Response("Not found", { status: 404 }));
	}
	return fetchLocalFile(pathToFileURL(filePath).toString(), {
		headers: Object.fromEntries(request.headers.entries()),
	});
}
