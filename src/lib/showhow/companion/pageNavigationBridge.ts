export const SHOWHOW_NAVIGATION_EVENT = "showhow:page-navigation";

export function installPageNavigationBridge(pageWindow: Window): void {
	const emit = () => pageWindow.dispatchEvent(new CustomEvent(SHOWHOW_NAVIGATION_EVENT));
	for (const method of ["pushState", "replaceState"] as const) {
		const original = pageWindow.history[method];
		pageWindow.history[method] = function (...args: Parameters<History[typeof method]>) {
			const result = original.apply(this, args);
			emit();
			return result;
		};
	}
	pageWindow.addEventListener("popstate", emit);
}
