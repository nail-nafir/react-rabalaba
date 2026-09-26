import type {
  MarketResearchContext,
  PageResearchContext,
  TerminalResearchContext,
} from "./terminal-context";

export type ChatRole = "user" | "assistant";

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

function eventText(value: unknown): string {
  if (!isRecord(value)) return "";
  if (typeof value.response === "string") return value.response;

  const choice = Array.isArray(value.choices) ? value.choices[0] : null;
  if (!isRecord(choice) || !isRecord(choice.delta)) return "";
  return typeof choice.delta.content === "string" ? choice.delta.content : "";
}

function parseEvent(
  frame: string,
  onText: (text: string) => void,
  onMarketContexts?: (contexts: MarketResearchContext[]) => void,
): boolean {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");

  if (!data) return false;
  if (data === "[DONE]") return true;

  const value: unknown = JSON.parse(data);
  if (
    onMarketContexts &&
    isRecord(value) &&
    Array.isArray(value.marketContexts) &&
    value.marketContexts.length <= 3
  ) {
    onMarketContexts(value.marketContexts as MarketResearchContext[]);
  }
  const text = eventText(value);
  if (text) onText(text);
  return false;
}

export async function readChatStream(
  stream: ReadableStream<Uint8Array>,
  onText: (text: string) => void,
  onMarketContexts?: (contexts: MarketResearchContext[]) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const result = await reader.read();
    buffer += decoder.decode(result.value, { stream: !result.done });

    let separator = /\r?\n\r?\n/.exec(buffer);
    while (separator) {
      const frame = buffer.slice(0, separator.index);
      buffer = buffer.slice(separator.index + separator[0].length);
      if (parseEvent(frame, onText, onMarketContexts)) {
        await reader.cancel();
        return;
      }
      separator = /\r?\n\r?\n/.exec(buffer);
    }

    if (result.done) break;
  }

  if (buffer.trim()) parseEvent(buffer, onText, onMarketContexts);
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
  await readChatStream(response.body, onText, onMarketContexts);
}
