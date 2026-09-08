const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const MAX_BODY_BYTES = 32 * 1024;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARACTERS = 2_000;
const MAX_TOTAL_CHARACTERS = 16_000;

const SYSTEM_PROMPT = `You are RabaLaba Research Copilot, an educational trading-research assistant.
- Reply in the same language as the user and stay concise.
- You cannot see the current RabaLaba page, screener, journal, portfolio, live prices, indicators, or news.
- Never invent current data. Say clearly when the user must provide data or verify it in the terminal.
- Help test a thesis, assumptions, invalidation, scenarios, and risk. Separate facts from inference.
- Do not promise profit, present certainty, or give autonomous trade-execution instructions.`;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonError(error: string, status: number) {
  return Response.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

async function readJson(request: Request): Promise<unknown | Response> {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    return jsonError("Content-Type must be application/json", 415);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonError("Request body is too large", 413);
  }
  if (!request.body) return jsonError("Request body is required", 400);

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  while (true) {
    const result = await reader.read();
    if (result.value) {
      bytes += result.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return jsonError("Request body is too large", 413);
      }
    }
    text += decoder.decode(result.value, { stream: !result.done });
    if (result.done) break;
  }

  try {
    return JSON.parse(text);
  } catch {
    return jsonError("Request body must be valid JSON", 400);
  }
}

function validMessages(value: unknown): ChatMessage[] | null {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "messages")) {
    return null;
  }
  if (
    !Array.isArray(value.messages) ||
    value.messages.length === 0 ||
    value.messages.length > MAX_MESSAGES
  ) {
    return null;
  }

  let characters = 0;
  const messages: ChatMessage[] = [];
  for (const valueMessage of value.messages) {
    if (
      !isRecord(valueMessage) ||
      Object.keys(valueMessage).length !== 2 ||
      (valueMessage.role !== "user" && valueMessage.role !== "assistant") ||
      typeof valueMessage.content !== "string" ||
      !valueMessage.content.trim() ||
      valueMessage.content.length > MAX_MESSAGE_CHARACTERS
    ) {
      return null;
    }
    characters += valueMessage.content.length;
    if (characters > MAX_TOTAL_CHARACTERS) return null;
    messages.push({
      role: valueMessage.role,
      content: valueMessage.content,
    });
  }

  return messages.at(-1)?.role === "user" ? messages : null;
}

function errorDetails(error: unknown) {
  if (!isRecord(error)) {
    return { code: "", status: 0, message: String(error) };
  }
  return {
    code: typeof error.code === "number" || typeof error.code === "string"
      ? String(error.code)
      : "",
    status: typeof error.status === "number" ? error.status : 0,
    message: typeof error.message === "string" ? error.message : "",
  };
}

async function authenticate(
  request: Request,
  env: Env,
): Promise<true | Response> {
  const match = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1];
  if (!token || token.length > 8_192) return jsonError("Unauthorized", 401);
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    return jsonError("Authentication service is unavailable", 503);
  }

  let response: Response;
  try {
    response = await fetch(
      new URL("/auth/v1/user", env.VITE_SUPABASE_URL),
      {
        headers: {
          Accept: "application/json",
          apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        signal: request.signal,
      },
    );
  } catch {
    return jsonError("Authentication service is unavailable", 503);
  }

  if (response.status === 401 || response.status === 403) {
    return jsonError("Unauthorized", 401);
  }
  if (!response.ok) return jsonError("Authentication service is unavailable", 503);

  try {
    const user: unknown = await response.json();
    return isRecord(user) && typeof user.id === "string"
      ? true
      : jsonError("Authentication service is unavailable", 503);
  } catch {
    return jsonError("Authentication service is unavailable", 503);
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await authenticate(context.request, context.env);
  if (auth instanceof Response) return auth;

  const body = await readJson(context.request);
  if (body instanceof Response) return body;

  const messages = validMessages(body);
  if (!messages) return jsonError("Invalid chat payload", 400);

  try {
    const stream = await context.env.AI.run(
      MODEL,
      {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
        max_completion_tokens: 600,
        temperature: 0.2,
        chat_template_kwargs: { enable_thinking: false },
        store: false,
      },
      { signal: context.request.signal, tags: ["rabalaba:chat"] },
    );

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const details = errorDetails(error);
    if (
      details.status === 429 ||
      details.code === "3036" ||
      details.code === "3040" ||
      /\b(?:3036|3040)\b/.test(details.message)
    ) {
      return jsonError("AI quota is temporarily unavailable", 429);
    }
    if (context.request.signal.aborted) {
      return jsonError("Request was aborted", 408);
    }

    console.error(
      JSON.stringify({ event: "chat_inference_failed", code: details.code || "unknown" }),
    );
    return jsonError("AI service is unavailable", 503);
  }
};
