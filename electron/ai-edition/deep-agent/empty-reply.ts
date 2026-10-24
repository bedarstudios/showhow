// #212: what crosses the bridge when a turn produced no assistant text. The code lets the
// renderer show localised copy and a Try again action; the sentence serves callers without a
// localiser (the MCP surface, an older renderer). Kept free of LangChain imports on purpose:
// chat-service loads deep-agent/service lazily, and this module must not drag it in.

import type { AiEditionChatErrorCode } from "../../../src/native/contracts";

export const EMPTY_REPLY_CODE: AiEditionChatErrorCode = "empty-reply";

export const EMPTY_REPLY_MESSAGE =
	"The AI didn't send a reply. Try again, or pick another model in Settings.";
