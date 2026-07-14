import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

let server;

async function loadModule(path) {
  if (!server) {
    server = await createServer({
      appType: "custom",
      configFile: "vite.config.ts",
      logLevel: "silent",
      server: { middlewareMode: true },
    });
  }
  return server.ssrLoadModule(path);
}

test.after(async () => {
  if (server) await server.close();
});

const SRC = "/src/features/testimonials/schemas/testimonial-schema.ts";
const translate = (_key, fallback) => fallback;

test("testimonial schema accepts valid content and trims text fields", async () => {
  const { createTestimonialSchema } = await loadModule(SRC);
  const schema = createTestimonialSchema(translate);

  assert.deepEqual(
    schema.parse({
      display_name: "  Rani  ",
      persona: "  Swing trader IDX  ",
      body: "  RabaLaba membantu saya merapikan proses riset harian.  ",
      rating: 5,
    }),
    {
      display_name: "Rani",
      persona: "Swing trader IDX",
      body: "RabaLaba membantu saya merapikan proses riset harian.",
      rating: 5,
    },
  );
});

test("testimonial schema rejects missing, oversized, and fractional ratings", async () => {
  const { createTestimonialSchema, TESTIMONIAL_LIMITS } = await loadModule(SRC);
  const schema = createTestimonialSchema(translate);
  const valid = {
    display_name: "Rani",
    persona: "Swing trader IDX",
    body: "RabaLaba membantu saya merapikan proses riset harian.",
    rating: 5,
  };

  const invalidCases = [
    { ...valid, display_name: "R" },
    { ...valid, persona: "X" },
    { ...valid, body: "terlalu pendek" },
    { ...valid, body: "x".repeat(TESTIMONIAL_LIMITS.body.max + 1) },
    { ...valid, rating: 0 },
    { ...valid, rating: 6 },
    { ...valid, rating: 4.5 },
  ];

  for (const candidate of invalidCases) {
    assert.equal(schema.safeParse(candidate).success, false);
  }
});
