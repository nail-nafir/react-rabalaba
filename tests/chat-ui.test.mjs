import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const widgetPath = join(
  root,
  "src/features/chat/components/research-copilot.tsx",
);
const widget = readFileSync(widgetPath, "utf8");
const assetDialog = readFileSync(
  join(root, "src/features/trading-plan/components/asset-detail-dialog.tsx"),
  "utf8",
);
const tradeDialog = readFileSync(
  join(root, "src/features/follow-trade/components/trade-detail-dialog.tsx"),
  "utf8",
);
const en = JSON.parse(
  readFileSync(join(root, "src/assets/locales/en.json"), "utf8"),
);
const id = JSON.parse(
  readFileSync(join(root, "src/assets/locales/id.json"), "utf8"),
);
const packageJson = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
);

function getPath(value, path) {
  return path.split(".").reduce((current, key) => current?.[key], value);
}

function stringValues(value) {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(stringValues);
}

test("chat copy, locale parity, and widget primitives stay consistent", () => {
  assert.equal(
    existsSync(join(root, "src/components/shared/empty-state.tsx")),
    false,
  );
  assert.match(widget, /from ["']@\/components\/ui\/popover["']/);
  assert.match(widget, /PopoverTrigger/);
  assert.match(widget, /PopoverContent/);
  assert.match(widget, /forceMount/);
  assert.match(widget, /modal=\{false\}/);
  assert.match(widget, /from ["']@\/components\/ui\/message["']/);
  assert.match(widget, /MessageAvatar/);
  assert.match(widget, /from ["']@\/components\/ui\/empty["']/);
  assert.match(widget, /<Empty\b/);
  assert.match(widget, /from ["']@\/components\/ui\/input-group["']/);
  assert.match(widget, /<InputGroup\b/);
  assert.match(widget, /role="alert"/);
  assert.match(widget, /aria-label=/);
  assert.match(widget, /aria-describedby=/);
  assert.match(widget, /aria-hidden="true"/);
  assert.match(widget, /motion-reduce:/);
  assert.match(
    widget,
    /100dvh-9\.5rem-env\(safe-area-inset-bottom\)/,
    "mobile chat panel must reserve viewport and safe-area space",
  );
  assert.match(widget, /max-h-\[calc\(100dvh-9\.5rem-env\(safe-area-inset-bottom\)\)\]/);
  assert.doesNotMatch(widget, /100dvh-7\.5rem/);
  assert.equal(
    typeof packageJson.dependencies["react-markdown"],
    "string",
    "react-markdown must remain a direct dependency",
  );
  assert.equal(
    typeof packageJson.dependencies["remark-gfm"],
    "string",
    "remark-gfm must remain a direct dependency",
  );
  assert.match(widget, /from ["']react-markdown["']/);
  assert.match(widget, /from ["']remark-gfm["']/);
  assert.match(widget, /activeResearchContext/);
  assert.match(widget, /researchCopilotRequestId/);
  assert.match(widget, /researchSessionId/);
  assert.match(
    widget,
    /useEffect\(\(\) => \{\s*if \(researchCopilotRequestId > 0\) setOpen\(true\);\s*\}, \[researchCopilotRequestId\]\)/,
    "research requests must open the widget after the triggering layer closes",
  );
  assert.doesNotMatch(widget, /handledRequestId|openRequested/);
  assert.match(widget, /open=\{open\}/);
  assert.match(widget, /aria-hidden=\{!open\}/);
  assert.match(widget, /onFocusOutside=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(widget, /!open && "invisible pointer-events-none/);
  assert.match(widget, /onClick=\{\(\) => setOpen\(false\)\}/);
  assert.match(widget, /terminalContext/);
  assert.match(widget, /sessionContext/);
  assert.match(widget, /context_label/);
  assert.match(widget, /clear_context/);
  const contextBadgeStart = widget.indexOf(
    "{sessionContext ? (",
  );
  const contextBadgeEnd = widget.indexOf("</Badge>", contextBadgeStart);
  const contextBadge = widget.slice(contextBadgeStart, contextBadgeEnd);
  assert.match(contextBadge, /TERMINAL_BADGE_CLASSNAME/);
  assert.match(contextBadge, /w-fit/);
  assert.match(contextBadge, /max-w-full/);
  assert.doesNotMatch(
    contextBadge,
    /flex-1|py-1/,
    "context badge must size to its content instead of filling the chat row",
  );
  assert.match(widget, /max-w-full/);
  assert.match(widget, /timeZone: "Asia\/Jakarta"/);
  assert.match(widget, /WIB/);
  assert.match(widget, /whitespace-nowrap/);
  assert.match(widget, /<ReactMarkdown\b/);
  assert.match(widget, /skipHtml/);
  assert.match(widget, /remarkPlugins=\{\[remarkGfm\]\}/);
  assert.match(widget, /allowedElements/);
  assert.match(widget, /CHAT_MARKDOWN_COMPONENTS/);
  assert.match(widget, /components=\{CHAT_MARKDOWN_COMPONENTS\}/);
  assert.doesNotMatch(
    widget,
    /function renderInlineMarkdown|function renderAssistantMarkdown|renderAssistantMarkdown/,
  );
  assert.match(widget, /<strong/);
  assert.match(widget, /<em/);
  assert.match(widget, /<del/);
  assert.match(widget, /<code/);
  assert.match(widget, /<blockquote/);
  assert.match(widget, /<hr/);
  assert.match(widget, /table:/);
  assert.match(widget, /min-w-md/);
  for (const element of [
    "blockquote",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ]) {
    assert.match(widget, new RegExp(`"${element}"`));
  }
  assert.match(widget, /list-decimal/);
  assert.match(widget, /list-disc/);
  assert.match(widget, /max-w-full overflow-x-auto/);
  assert.match(widget, /bg-background\/70/);
  assert.match(widget, /border border-border\/60/);
  assert.match(widget, /focus-visible:ring-2 focus-visible:ring-ring/);
  const triggerStart = widget.indexOf("<PopoverTrigger asChild>");
  const triggerEnd = widget.indexOf("</PopoverTrigger>", triggerStart);
  const trigger = widget.slice(triggerStart, triggerEnd);
  assert.match(trigger, /<Button\b/);
  for (const cardToken of [
    "rounded-xl",
    "border border-border",
    "bg-card/45",
    "backdrop-blur-xs",
    "ring-1 ring-foreground/10",
  ]) {
    assert.match(
      trigger,
      new RegExp(cardToken.replaceAll("/", "\\/")),
      `Sensei trigger must retain testimonial card token: ${cardToken}`,
    );
  }
  assert.doesNotMatch(
    trigger,
    /rounded-2xl|border-primary\/25|bg-card\/95|shadow-xl|shadow-2xl/,
    "Sensei trigger must not use the old pill/glow surface",
  );
  for (const openStateToken of [
    "data-[state=open]:-translate-y-0.5",
    "data-[state=open]:bg-card/60",
    "group-data-[state=open]:scale-105",
    "group-data-[state=open]:rotate-6",
    "group-data-[state=open]:bg-primary",
    "group-data-[state=open]:text-primary",
  ]) {
    assert.ok(
      trigger.includes(openStateToken),
      `Sensei trigger must mirror hover styling while open: ${openStateToken}`,
    );
  }
  assert.match(trigger, /BotIcon/);
  assert.match(trigger, /chat\.ask/);
  assert.match(trigger, /chat\.title/);
  assert.doesNotMatch(widget, /dangerouslySetInnerHTML|rehype-raw/);
  assert.match(
    widget,
    /text: t\(`chat\.prompts\.\$\{template\.key\}`\)/,
  );
  assert.match(widget, /function randomPromptTemplates\(\)/);
  assert.match(
    widget,
    /new Set\(PROMPT_TEMPLATE_CONFIG\.map\(\(\{ accent \}\) => accent\)\)/,
  );
  assert.match(widget, /return accents\.map\(\(accent\) =>/);
  assert.match(widget, /useState\(\s*randomPromptTemplates,?\s*\)/);
  assert.match(widget, /setPromptTemplateConfig\(randomPromptTemplates\(\)\)/);
  assert.match(widget, /promptTemplateConfig\.map\(/);
  assert.match(widget, /<EmptyHeader className="w-full items-start/);
  assert.match(widget, /<div className="w-full space-y-1 text-left">/);
  assert.doesNotMatch(widget, /text-center/);
  const promptStart = widget.indexOf("{promptTemplates.map((template) => (");
  const promptEnd = widget.indexOf("</EmptyContent>", promptStart);
  const promptSection = widget.slice(promptStart, promptEnd);
  assert.match(promptSection, /<Card\b/);
  assert.doesNotMatch(promptSection, /<Button\b/);
  assert.match(
    promptSection,
    /group w-full cursor-pointer select-none border border-border transition-all duration-200/,
  );
  assert.match(promptSection, /hover:border-primary hover:bg-muted\/50/);
  assert.match(promptSection, /role="button"/);
  assert.match(promptSection, /tabIndex=\{0\}/);
  assert.match(promptSection, /aria-label=\{template\.text\}/);
  assert.match(promptSection, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(promptSection, /template\.accent/);
  assert.match(promptSection, /justify-between/);
  assert.match(promptSection, /<template\.icon/);
  const accentValues = [
    ...widget.matchAll(/accent:\s*(?:"([^"]+)"|\n\s*"([^"]+)")/g),
  ].map((match) => match[1] ?? match[2]);
  assert.equal(accentValues.length, 8, "all eight templates need an accent");
  assert.equal(
    new Set(accentValues).size,
    3,
    "three visible templates must map to three unique accent groups",
  );
  assert.match(assetDialog, /buildAssetResearchContext/);
  assert.match(assetDialog, /setResearchContext/);
  assert.match(assetDialog, /openResearchCopilot/);
  assert.match(assetDialog, /chat\.ask_sensei/);
  assert.match(
    assetDialog,
    /variant="ghost"\s+size="icon-sm"[\s\S]*?chat\.ask_sensei[\s\S]*?className="size-11 cursor-pointer sm:size-7"[\s\S]*?<Bot className="size-3\.5"/,
  );
  assert.match(
    assetDialog,
    /<DialogClose asChild>\s*<Button\s+type="button"\s+variant="ghost"\s+size="icon-sm"\s+onClick=\{handleAskSensei\}[\s\S]*?<\/Button>\s*<\/DialogClose>/,
    "asset handoff must close its detail dialog",
  );
  assert.doesNotMatch(
    assetDialog,
    /chat\.ask_sensei[\s\S]*?<span className="hidden sm:inline">/,
  );
  assert.match(tradeDialog, /buildTradeResearchContext/);
  assert.match(tradeDialog, /setResearchContext/);
  assert.match(tradeDialog, /openResearchCopilot/);
  assert.match(tradeDialog, /chat\.ask_sensei/);
  assert.match(
    tradeDialog,
    /variant="ghost"\s+size="icon-sm"[\s\S]*?chat\.ask_sensei[\s\S]*?className="size-11 cursor-pointer sm:size-7"[\s\S]*?<Bot className="size-3\.5"/,
  );
  assert.match(
    tradeDialog,
    /<DialogClose asChild>\s*<Button\s+type="button"\s+variant="ghost"\s+size="icon-sm"\s+onClick=\{handleAskSensei\}[\s\S]*?<\/Button>\s*<\/DialogClose>/,
    "trade handoff must close its detail dialog",
  );
  assert.doesNotMatch(
    tradeDialog,
    /chat\.ask_sensei[\s\S]*?<span className="hidden sm:inline">/,
  );
  for (const key of [
    "thesis",
    "invalidation",
    "risk",
    "entry",
    "context",
    "management",
    "catalyst",
    "timeframe",
  ]) {
    assert.match(widget, new RegExp(`key: "${key}"`));
  }
  assert.doesNotMatch(widget, /panelRef|document\.activeElement/);
  assert.doesNotMatch(
    widget,
    />\s*[A-Za-z][^<{]*<\/[A-Za-z]/,
    "visible widget copy must come from translations",
  );

  assert.deepEqual(
    Object.keys(en.chat),
    Object.keys(id.chat),
    "EN/ID chat keys differ",
  );
  assert.equal(en.chat.placeholder, "Break down a setup…");
  assert.equal(id.chat.placeholder, "Bedah setup dulu…");

  const requiredKeys = [
    "title",
    "description",
    "badge",
    "open",
    "close",
    "new_chat",
    "empty_title",
    "empty_description",
    "login_title",
    "login_description",
    "loading",
    "trader",
    "sensei",
    "thinking",
    "input_label",
    "placeholder",
    "composer_hint",
    "send",
    "stop",
    "copy",
    "copied",
    "copy_failed",
    "retry",
    "scroll_latest",
    "messages_label",
    "prompts.thesis",
    "prompts.invalidation",
    "prompts.risk",
    "prompts.entry",
    "prompts.context",
    "prompts.management",
    "prompts.catalyst",
    "prompts.timeframe",
    "errors.auth",
    "errors.input",
    "errors.rate",
    "errors.unavailable",
  ];
  for (const key of requiredKeys) {
    assert.equal(typeof getPath(en.chat, key), "string", `EN missing chat.${key}`);
    assert.equal(typeof getPath(id.chat, key), "string", `ID missing chat.${key}`);
  }

  const copyValues = [
    ...stringValues(en.chat),
    en.common.load_error_title,
    en.common.load_error_description,
    ...stringValues(id.chat),
    id.common.load_error_title,
    id.common.load_error_description,
  ];
  const forbiddenPronoun =
    /\b(?:i|me|my|mine|we|us|our|ours|you|your|yours|they|them|their|theirs|aku|saya|kami|kita|kamu|kalian|mereka|anda|gue|lo)\b/i;
  for (const copy of copyValues) {
    assert.doesNotMatch(copy, forbiddenPronoun, `forbidden pronoun in: ${copy}`);
    assert.doesNotMatch(copy, /-/, `ASCII dash in: ${copy}`);
  }

  const pairedPaths = [
    ...requiredKeys,
    "title",
    "description",
  ];
  for (const path of pairedPaths) {
    const enCopy = getPath(en.chat, path);
    const idCopy = getPath(id.chat, path);
    const ratio = idCopy.length / enCopy.length;
    assert.ok(
      ratio >= 0.65 && ratio <= 1.6,
      `copy length is unbalanced for chat.${path}: ${enCopy.length}/${idCopy.length}`,
    );
  }
  for (const key of ["load_error_title", "load_error_description"]) {
    const ratio = id.common[key].length / en.common[key].length;
    assert.ok(
      ratio >= 0.65 && ratio <= 1.6,
      `copy length is unbalanced for common.${key}`,
    );
  }
});
