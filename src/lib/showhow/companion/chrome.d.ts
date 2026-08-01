declare const chrome: {
	runtime: {
		sendMessage: (message: unknown) => Promise<unknown>;
		onMessage: {
			addListener: (
				listener: (
					message: unknown,
					sender: unknown,
					sendResponse: (response: unknown) => void,
				) => unknown,
			) => void;
		};
	};
	storage: {
		local: {
			get: (keys: string[]) => Promise<Record<string, unknown>>;
			set: (values: Record<string, unknown>) => Promise<void>;
		};
	};
	tabs: { captureVisibleTab: (windowId?: number, options?: { format: "png" }) => Promise<string> };
};
