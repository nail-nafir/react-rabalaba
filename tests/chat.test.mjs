import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

let server;
const originalFetch = globalThis.fetch;

async function loadModule(path) {
  if (!server) {
    server = await createServer({
      appType: "custom",
      configFile: "vite.config.ts",
      logLevel: "silent",
      server: { middlewareMode: true, watch: null },
    });
  }
  return server.ssrLoadModule(path);
}

function request(body, token = "test-token") {
  return new Request("https://rabalaba.pages.dev/api/chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function context(chatRequest, ai) {
  return {
    request: chatRequest,
    env: {
      AI: ai,
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    },
  };
}

function stream(...chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test.after(async () => {
  if (server) await server.close();
});

test("chat rejects unauthenticated requests", async () => {
  const { onRequestPost } = await loadModule("/functions/api/chat.ts");
  const response = await onRequestPost(
    context(
      new Request("https://rabalaba.pages.dev/api/chat", { method: "POST" }),
      { run: () => assert.fail("AI should not run") },
    ),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("chat rejects an invalid payload", async () => {
  globalThis.fetch = async () => Response.json({ id: "user-1" });
  const { onRequestPost } = await loadModule("/functions/api/chat.ts");
  const response = await onRequestPost(
    context(request({ messages: [], context: {} }), {
      run: () => assert.fail("AI should not run"),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid chat payload" });
});

test("chat validates auth and streams the locked Workers AI model", async () => {
  let authRequest;
  let inference;
  globalThis.fetch = async (input, init) => {
    authRequest = { url: input.toString(), init };
    return Response.json({ id: "user-1" });
  };
  const ai = {
    run(model, input, options) {
      inference = { model, input, options };
      return stream('data: {"response":"hello"}\n\n', "data: [DONE]\n\n");
    },
  };
  const { onRequestPost } = await loadModule("/functions/api/chat.ts");
  const response = await onRequestPost(
    context(request({ messages: [{ role: "user", content: "Test this" }] }), ai),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/event-stream; charset=utf-8");
  assert.equal(await response.text(), 'data: {"response":"hello"}\n\ndata: [DONE]\n\n');
  assert.equal(authRequest.url, "https://project.supabase.co/auth/v1/user");
  assert.equal(authRequest.init.headers.apikey, "publishable-key");
  assert.equal(authRequest.init.headers.Authorization, "Bearer test-token");
  assert.equal(inference.model, "@cf/google/gemma-4-26b-a4b-it");
  assert.equal(inference.input.stream, true);
  assert.equal(inference.input.messages[0].role, "system");
  assert.match(
    inference.input.messages[0].content,
    /Use restrained Markdown only when it improves scanability/,
  );
  assert.match(
    inference.input.messages[0].content,
    /Avoid tables, blockquotes, code fences, horizontal rules, decorative symbols, and excessive headings/,
  );
  assert.deepEqual(inference.input.messages.at(-1), {
    role: "user",
    content: "Test this",
  });
  assert.deepEqual(inference.input.chat_template_kwargs, {
    enable_thinking: false,
  });
  assert.equal("user" in inference.input, false);
  assert.deepEqual(inference.options.tags, ["rabalaba:chat"]);
});

test("chat maps Workers AI quota errors to 429", async () => {
  globalThis.fetch = async () => Response.json({ id: "user-1" });
  const { onRequestPost } = await loadModule("/functions/api/chat.ts");
  const response = await onRequestPost(
    context(request({ messages: [{ role: "user", content: "Hello" }] }), {
      run() {
        throw { code: 3036, message: "Daily limit exceeded" };
      },
    }),
  );

  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), {
    error: "AI quota is temporarily unavailable",
  });
});

test("SSE parser handles fragmented chunks and DONE", async () => {
  const { readChatStream } = await loadModule(
    "/src/features/chat/chat-stream.ts",
  );
  let output = "";

  await readChatStream(
    stream(
      'data: {"choices":[{"delta":{"content":"Hel',
      'lo"}}]}\r\n\r',
      '\ndata: {"response":"!"}\n\ndata: [DONE]\n\n',
    ),
    (text) => {
      output += text;
    },
  );

  assert.equal(output, "Hello!");
});
