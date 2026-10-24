import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://showhow-agy.pages.dev", // Change this to the custom domain when it arrives.
	integrations: [react()],
	devToolbar: { enabled: false },
	server: { host: "127.0.0.1", port: 4321 },
});
