import type {
  MarketResearchContext,
  PageResearchContext,
  TerminalResearchContext,
} from "./terminal-context";

export type ChatRole = "user" | "assistant";
export type ChatStreamErrorCode = "rate" | "unavailable" | "incomplete";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  terminalContext?: TerminalResearchContext | null;
  pageContext?: PageResearchContext | null;
  marketContexts?: MarketResearchContext[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function chatEventText(value: unknown): string {
  if (!isRecord(value)) return "";
  if (typeof value.response === "string") return value.response;

  const choice = Array.isArray(value.choices) ? value.choices[0] : null;
  if (!isRecord(choice) || !isRecord(choice.delta)) return "";
  return typeof choice.delta.content === "string" ? choice.delta.content : "";
}

function parseEvent(frame: string): unknown {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");

  if (!data) return undefined;
  return data === "[DONE]" ? data : JSON.parse(data);
}

export async function* readChatEvents(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const cancel = () => { void reader.cancel(signal?.reason).catch(() => undefined); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      const result = await reader.read();
      signal?.throwIfAborted();
      buffer += decoder.decode(result.value, { stream: !result.done });

      let separator = /\r?\n\r?\n/.exec(buffer);
      while (separator) {
        if (separator.index > 256 * 1024) throw new Error("Chat event is too large");
        const value = parseEvent(buffer.slice(0, separator.index));
        buffer = buffer.slice(separator.index + separator[0].length);
        if (value !== undefined) yield value;
        if (value === "[DONE]") return;
        separator = /\r?\n\r?\n/.exec(buffer);
      }

      if (buffer.length > 256 * 1024) throw new Error("Chat event is too large");
      if (result.done) break;
    }

    if (buffer.trim()) {
      const value = parseEvent(buffer);
      if (value !== undefined) yield value;
    }
  } finally {
    signal?.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function readChatStream(
  stream: ReadableStream<Uint8Array>,
  onText: (text: string) => void,
  onMarketContexts?: (contexts: MarketResearchContext[]) => void,
  signal?: AbortSignal,
) {
  for await (const value of readChatEvents(stream, signal)) {
    if (value === "[DONE]") return;
    if (!isRecord(value)) continue;
    if (value.error) {
      const code = isRecord(value.error) ? value.error.code : "unavailable";
      throw Object.assign(new Error("Chat stream failed"), { code });
    }
    if (Array.isArray(value.marketContexts) && value.marketContexts.length <= 3) {
      onMarketContexts?.(value.marketContexts as MarketResearchContext[]);
    }
    const text = chatEventText(value);
    if (text) onText(text);
  }
  throw Object.assign(new Error("Chat stream ended early"), { code: "incomplete" });
}

function requestMessages(messages: ChatMessage[]) {
  const selected: Array<{ role: ChatRole; content: string }> = [];
  let characters = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (selected.length === 20) break;
    if (!message.content) continue;

    const content = message.content.slice(0, 2_000);
    if (characters + content.length > 16_000) break;
    selected.unshift({ role: message.role, content });
    characters += content.length;
  }

  if (selected[0]?.role === "assistant") selected.shift();
  return selected;
}

export async function streamChat(
  messages: ChatMessage[],
  accessToken: string,
  onText: (text: string) => void,
  signal: AbortSignal,
  onMarketContexts?: (contexts: MarketResearchContext[]) => void,
) {
  const turn = messages.findLast((message) => message.role === "user");
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: requestMessages(messages),
      ...(turn?.terminalContext ? { terminalContext: turn.terminalContext } : {}),
      ...(turn?.pageContext ? { pageContext: turn.pageContext } : {}),
      ...(turn?.marketContexts?.length ? { marketContexts: turn.marketContexts } : {}),
    }),
    signal,
  });

  if (!response.ok) {
    let message = "Chat request failed";
    try {
      const payload: unknown = await response.json();
      if (isRecord(payload) && typeof payload.error === "string") {
        message = payload.error;
      }
    } catch {
      // The status is enough for the localized UI error.
    }
    throw Object.assign(new Error(message), { status: response.status });
  }

  if (!response.body) throw new Error("Chat response was empty");
  await readChatStream(response.body, onText, onMarketContexts, signal);
}
