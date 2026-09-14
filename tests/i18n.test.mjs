import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const resources = Object.fromEntries(
  ["id", "en"].map((language) => [
    language,
    {
      translation: JSON.parse(
        readFileSync(`src/assets/locales/${language}.json`, "utf8"),
      ),
    },
  ]),
);
const get = (object, key) =>
  key.split(".").reduce((value, part) => value?.[part], object);
function leaves(value, prefix = "") {
  return value && typeof value === "object"
    ? Object.entries(value).flatMap(([key, child]) =>
        leaves(child, prefix ? `${prefix}.${key}` : key),
      )
    : [[prefix, value]];
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(`${directory}/${entry.name}`)
      : /\.tsx?$/.test(entry.name)
        ? [`${directory}/${entry.name}`]
        : [],
  );
}
const sources = files("src").map((file) =>
  ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  ),
);
function walk(node, visitor) {
  visitor(node);
  ts.forEachChild(node, (child) => walk(child, visitor));
}
let server;
async function load(path) {
  server ??= await createServer({
    appType: "custom",
    configFile: "vite.config.ts",
    logLevel: "silent",
    server: { middlewareMode: true, watch: null },
  });
  return server.ssrLoadModule(path);
}
test.after(async () => {
  await server?.close();
});

test("locales have matching structure, nonempty values, unique keys and matching placeholders", () => {
  const shape = (value) =>
    Array.isArray(value)
      ? value.map(shape)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([key, child]) => [key, shape(child)]),
          )
        : typeof value;
  assert.deepEqual(
    shape(resources.id.translation),
    shape(resources.en.translation),
  );
  const maps = Object.fromEntries(
    Object.entries(resources).map(([language, resource]) => [
      language,
      Object.fromEntries(leaves(resource.translation)),
    ]),
  );
  assert.deepEqual(Object.keys(maps.id).sort(), Object.keys(maps.en).sort());
  const placeholders = (text) =>
    [...text.matchAll(/{{\s*-?\s*([^}]+?)\s*}}/g)]
      .map((match) => match[1])
      .sort();
  for (const key of Object.keys(maps.id)) {
    for (const language of ["id", "en"]) {
      assert.equal(typeof maps[language][key], "string", `${language}.${key}`);
      assert.ok(maps[language][key].trim(), `${language}.${key} is empty`);
    }
    assert.deepEqual(
      placeholders(maps.id[key]),
      placeholders(maps.en[key]),
      key,
    );
  }
  for (const language of ["id", "en"]) {
    const file = `src/assets/locales/${language}.json`;
    const source = ts.parseJsonText(file, readFileSync(file, "utf8"));
    assert.equal(source.parseDiagnostics.length, 0, file);
    walk(source, (node) => {
      if (ts.isArrayLiteralExpression(node))
        assert.ok(node.elements.length, `${file}: empty array`);
      if (!ts.isObjectLiteralExpression(node)) return;
      const keys = node.properties.map((property) => property.name.text);
      assert.equal(
        new Set(keys).size,
        keys.length,
        `${file}: duplicate JSON key`,
      );
      assert.ok(keys.length, `${file}: empty object`);
    });
  }
});

test("static translation references and plural families exist in both locales", () => {
  const roots = Object.keys(resources.en.translation);
  const references = new Set();
  for (const source of sources.filter(
    (source) => !source.fileName.startsWith("src/store/"),
  ))
    walk(source, (node) => {
      // Includes t/i18n.t, schemas, labelKey maps and AnalysisText keys.
      if (
        (ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node)) &&
        roots.some((root) => node.text.startsWith(`${root}.`)) &&
        /^[\w.]+$/.test(node.text)
      )
        references.add(node.text);
      if (
        ts.isBinaryExpression(node) &&
        ts.isCallExpression(node.left) &&
        /^(t|i18n\.t|i18next\.t)$/.test(node.left.expression.getText(source)) &&
        ts.isStringLiteral(node.right) &&
        [
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(node.operatorToken.kind)
      )
        assert.fail(`${source.fileName}: redundant text fallback`);
      if (
        ts.isCallExpression(node) &&
        /^(t|i18n\.t|i18next\.t)$/.test(node.expression.getText(source)) &&
        node.arguments[1]
      ) {
        assert.ok(
          !ts.isStringLiteral(node.arguments[1]),
          `${source.fileName}: redundant text fallback`,
        );
      }
    });
  for (const [language, { translation }] of Object.entries(resources)) {
    for (const key of references)
      assert.ok(
        get(translation, key) != null ||
          get(translation, `${key}_other`) != null,
        `${language}: missing ${key}`,
      );
    for (const [key] of leaves(translation)) {
      if (key.endsWith("_one") || key.endsWith("_other")) {
        const base = key.replace(/_(one|other)$/, "");
        assert.ok(get(translation, `${base}_one`), `${language}.${base}_one`);
        assert.ok(
          get(translation, `${base}_other`),
          `${language}.${base}_other`,
        );
      }
    }
  }
});

test("dynamic trading, asset and trial keys resolve for their supported values", async () => {
  const { ASSET_FILTER_TYPES } = await load("/src/constants/taxonomy/asset.ts");
  const { RISK_LEVELS } = await load("/src/constants/taxonomy/risk.ts");
  const { buildTradeSetupModel } = await load(
    "/src/features/trading-plan/model/trade-setup-model.ts",
  );
  const model = buildTradeSetupModel(
    [],
    {
      entry: 100,
      stopLoss: 95,
      takeProfit1: 105,
      takeProfit2: 110,
      takeProfit3: 115,
      riskRewardRatio: 3,
    },
    "long",
    102,
  );
  const keys = [
    ...ASSET_FILTER_TYPES.map(
      (type) => `common.asset_types.${type.replaceAll("-", "_")}`,
    ),
    ...RISK_LEVELS.map((risk) => `common.risk_levels.${risk}`),
    ...model.levels.map((level) => `dialog.${level.labelKey}`),
    ...["rising", "falling", "flat"].map((trend) => `dialog.obv_${trend}`),
    ...["free", "trial", "premium"].map((tier) => `license.tier_${tier}`),
    ...["pending", "blocked", "unavailable"].map(
      (status) => `dialog.signal_${status}_note`,
    ),
  ];
  const instance = createInstance();
  await instance.init({ resources, lng: "id", fallbackLng: false });
  for (const language of ["id", "en"]) {
    await instance.changeLanguage(language);
    for (const key of keys)
      assert.ok(instance.exists(key), `${language}.${key}`);
    for (const count of [0, 1, 5]) {
      const value = instance.t("license.status_trial", { count });
      assert.ok(value.includes(String(count)), value);
      assert.doesNotMatch(value, /{{|license\./);
      if (language === "en")
        assert.match(value, count === 1 ? /1 day left/ : /days left/);
      assert.equal(
        instance.t("dialog.bt_trades", { count }),
        language === "id"
          ? `${count} transaksi`
          : `${count} ${count === 1 ? "trade" : "trades"}`,
      );
    }
  }
});

test("stored validation errors translate at render and preserve non-key messages", async () => {
  const { authSchema, registerSchema } = await load(
    "/src/features/auth/schemas/auth-schema.ts",
  );
  const { FormFieldError } = await load(
    "/src/components/shared/form-field-error.tsx",
  );
  const result = authSchema.safeParse({ email: "bad", password: "123" });
  assert.equal(result.success, false);
  const errors = result.error.issues;
  assert.deepEqual(
    errors.map((error) => error.message),
    ["auth.email_invalid", "auth.password_min"],
  );
  assert.ok(
    authSchema.safeParse({ email: "qa@example.com", password: "123456" })
      .success,
  );
  assert.equal(
    registerSchema.safeParse({
      email: "qa@example.com",
      password: "123456",
      confirmPassword: "654321",
    }).error.issues[0].message,
    "auth.confirm_password_mismatch",
  );
  const instance = createInstance();
  await instance.init({ resources, lng: "id" });
  const render = (values) =>
    renderToStaticMarkup(
      React.createElement(
        I18nextProvider,
        { i18n: instance },
        React.createElement(FormFieldError, { errors: values }),
      ),
    );
  for (const language of ["id", "en", "id"]) {
    await instance.changeLanguage(language);
    const html = render(errors);
    assert.ok(html.includes(instance.t("auth.email_invalid")));
    assert.ok(html.includes(instance.t("auth.password_min")));
    assert.doesNotMatch(html, /auth\./);
    assert.equal(
      (render([errors[0], errors[0]]).match(/<li/g) ?? []).length,
      0,
    );
    assert.ok(
      render([{ message: "Custom application message" }]).includes(
        "Custom application message",
      ),
    );
  }
});

test("calendar and share cards use the provided language", async () => {
  const { Calendar } = await load("/src/components/ui/calendar.tsx");
  const { id, enUS } = await import("react-day-picker/locale");
  const { buildShareCardSvg } = await load(
    "/src/features/trading-plan/model/share-card.ts",
  );
  const { buildTradeSetupModel } = await load(
    "/src/features/trading-plan/model/trade-setup-model.ts",
  );
  const candles = [
    {
      timestamp: 1789084800,
      open: 100,
      high: 106,
      low: 98,
      close: 104,
      volume: 1000,
    },
  ];
  const model = buildTradeSetupModel(
    candles,
    {
      entry: 100,
      stopLoss: 95,
      takeProfit1: 105,
      takeProfit2: 110,
      takeProfit3: 115,
      riskRewardRatio: 3,
    },
    "long",
    104,
  );
  const instance = createInstance();
  await instance.init({ resources, lng: "id" });
  for (const language of ["id", "en"]) {
    await instance.changeLanguage(language);
    const html = renderToStaticMarkup(
      React.createElement(
        I18nextProvider,
        { i18n: instance },
        React.createElement(Calendar, {
          month: new Date(2026, 8, 1),
          locale: language === "id" ? id : enUS,
        }),
      ),
    );
    assert.ok(
      html.includes(
        language === "id" ? "Ke bulan berikutnya" : "Go to the Next Month",
      ),
    );
    for (const isPosition of [false, true])
      for (const closed of [false, true]) {
        const svg = buildShareCardSvg(
          model,
          {
            symbol: "QA<&>",
            candles,
            strength: 80,
            currentPrice: 104,
            assetType: "crypto",
            isPosition,
            closed,
            pnlR: 0.8,
            pnlPct: 4,
            locale: language,
            markers: [
              { kind: "entry", timestamp: candles[0].timestamp, price: 100 },
            ],
          },
          instance.t.bind(instance),
        );
        assert.ok(svg.includes("QA&lt;&amp;&gt;"));
        assert.ok(
          svg.includes(instance.t("dialog.share_card.generated").toUpperCase()),
        );
        assert.ok(svg.includes(instance.t("dialog.share_card.disclaimer")));
        assert.doesNotMatch(svg, /NaN|undefined|{{|dialog\.|journal\./);
        if (isPosition)
          assert.ok(
            svg.includes(
              instance
                .t(
                  closed
                    ? "dialog.share_card.realized_pnl"
                    : "dialog.share_card.floating_pnl",
                )
                .toUpperCase(),
            ),
          );
      }
  }
});
