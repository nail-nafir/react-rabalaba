import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const INDEX_HTML = readFileSync("index.html", "utf8");
const FAVICON_SVG = readFileSync("public/favicon.svg", "utf8");

function metaContent(attribute, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = INDEX_HTML.match(
    new RegExp(
      `<meta\\s+${attribute}="${escapedKey}"\\s+content="([^"]+)"\\s*/>`,
    ),
  );
  assert.ok(match, `Missing ${attribute}=${key} metadata`);
  return match[1];
}

test("static social preview metadata is crawler-ready", () => {
  assert.match(INDEX_HTML, /<title>RabaLaba \| Terminal Riset Multi Aset<\/title>/);
  assert.match(
    INDEX_HTML,
    /<link rel="canonical" href="https:\/\/rabalaba\.pages\.dev\/" \/>/,
  );

  const expected = {
    "og:title": "RabaLaba | Terminal Riset Multi Aset",
    "og:description":
      "Terminal riset trading multi aset untuk membaca sinyal, menyusun rencana trading, dan mengelola risiko.",
    "og:type": "website",
    "og:url": "https://rabalaba.pages.dev/",
    "og:site_name": "RabaLaba",
    "og:locale": "id_ID",
    "og:image": "https://rabalaba.pages.dev/og-image.png",
    "og:image:alt": "RabaLaba Terminal Riset Multi Aset",
    "og:image:type": "image/png",
    "og:image:width": "1200",
    "og:image:height": "630",
  };

  for (const [key, value] of Object.entries(expected)) {
    assert.equal(metaContent("property", key), value);
  }

  for (const value of [
    expected["og:title"],
    expected["og:description"],
    expected["og:image:alt"],
  ]) {
    assert.doesNotMatch(value, /-/);
  }

  assert.equal(metaContent("name", "twitter:card"), "summary_large_image");
  assert.equal(metaContent("name", "twitter:title"), expected["og:title"]);
  assert.equal(
    metaContent("name", "twitter:description"),
    expected["og:description"],
  );
  assert.equal(metaContent("name", "twitter:image"), expected["og:image"]);
  assert.equal(
    metaContent("name", "twitter:image:alt"),
    expected["og:image:alt"],
  );

  assert.doesNotMatch(INDEX_HTML, /document\.head|createElement\(["']meta/);
});

test("social preview image is a 1200 by 630 PNG", () => {
  const image = readFileSync("public/og-image.png");
  assert.deepEqual(
    image.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
});

test("favicon keeps the social preview brand mark", () => {
  assert.match(
    INDEX_HTML,
    /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/,
  );
  assert.match(FAVICON_SVG, /viewBox="0 0 64 64"/);
  assert.match(FAVICON_SVG, /<rect width="64" height="64" rx="16"/);
  assert.match(FAVICON_SVG, /id="surface"/);
  assert.match(FAVICON_SVG, /M16\.247 7\.761a6 6 0 0 1 0 8\.478/);
  assert.match(FAVICON_SVG, /<circle cx="12" cy="12" r="2" fill="#FFFFFF"/);
  assert.doesNotMatch(FAVICON_SVG, /id="bolt"|M37\.5 8/);
});
