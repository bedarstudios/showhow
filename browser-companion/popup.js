/* global chrome */
// biome-ignore-all lint/correctness/noUndeclaredVariables: Chrome provides this extension API.

const status = document.querySelector("#status");
const endpoint = document.querySelector("#endpoint");
const token = document.querySelector("#token");

async function refresh() {
	const values = await chrome.storage.local.get(["endpoint", "token", "paired"]);
	endpoint.value = values.endpoint || "ws://127.0.0.1:8765";
	token.value = values.token || "";
	status.textContent = values.paired ? "Browser: Paired" : "Browser: Unpaired";
	status.classList.toggle("paired", values.paired === true);
}

document.querySelector("#save").addEventListener("click", async () => {
	await chrome.storage.local.set({ endpoint: endpoint.value.trim(), token: token.value.trim() });
	chrome.runtime.sendMessage({ type: "showhow:reconnect" });
});

chrome.storage.onChanged.addListener(refresh);
void refresh();
