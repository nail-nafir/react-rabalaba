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
  assert.match(widget, /const \[manualOpen, setManualOpen\] = useState\(false\)/);
  assert.match(
    widget,
    /const \[dismissedRequestId, setDismissedRequestId\] = useState\(0\)/,
  );
  assert.match(
    widget,
    /manualOpen \|\| researchCopilotRequestId > dismissedRequestId/,
    "research requests must derive the widget open state without an effect",
  );
  assert.doesNotMatch(widget, /eslint-disable react-hooks\/set-state-in-effect/);
  assert.doesNotMatch(widget, /handledRequestId|openRequested/);
  assert.match(widget, /open=\{open\}/);
  assert.match(widget, /aria-hidden=\{!open\}/);
  assert.match(widget, /onFocusOutside=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(widget, /!open && "invisible pointer-events-none/);
  assert.match(widget, /onClick=\{\(\) => handleOpenChange\(false\)\}/);
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
  assert.match(
    widget,
    /w-\[calc\(100vw-2rem\)\][\s\S]*md:w-\[42rem\]/,
    "Sensei panel must leave mobile viewport gutters and match detail dialog width",
  );
  assert.match(
    assetDialog,
    /<DialogContent className="sm:max-w-2xl/,
    "Asset detail dialog is the width source of truth",
  );
  assert.match(
    tradeDialog,
    /<DialogContent className="sm:max-w-2xl/,
    "Trade detail dialog is the width source of truth",
  );
  assert.match(
    widget,
    /h-\[min\(560px,calc\(100dvh-9\.5rem-env\(safe-area-inset-bottom\)\)\)\]/,
    "Sensei panel must stay compact on mobile",
  );
  assert.match(
    widget,
    /sm:h-\[min\(600px,calc\(100dvh-6\.5rem\)\)\]/,
    "Sensei panel must stay compact on desktop",
  );
  assert.match(widget, /align="center"/);
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
  const messageRowsStart = widget.indexOf(
    "{messages.map((message, index) =>",
  );
  const waitingStateStart = widget.indexOf(
    "{waitingForFirstToken ? (",
    messageRowsStart,
  );
  const messageRows = widget.slice(messageRowsStart, waitingStateStart);
  assert.match(
    messageRows,
    /align=\{message\.role === "user" \? "end" : "start"\}/,
    "bubbles must follow the same alignment as their Message row",
  );
  assert.match(messageRows, /variant=\{[\s\S]*message\.role/);
  assert.match(
    messageRows,
    /<MessageAvatar className=\{CHAT_AVATAR_CLASSNAME\}>/,
    "all senders must use the circular MessageAvatar composition",
  );
  assert.match(
    widget,
    /const CHAT_AVATAR_CLASSNAME =\s*"size-8 shrink-0 self-end rounded-full border border-border bg-muted text-muted-foreground"/,
    "sender avatars must share one neutral visual source of truth",
  );
  assert.equal(
    widget.match(/<MessageAvatar className=\{CHAT_AVATAR_CLASSNAME\}>/g)
      ?.length,
    3,
    "normal, loading, and error messages must reuse the same avatar class",
  );
  assert.match(messageRows, /UserRoundIcon/);
  assert.match(messageRows, /BotIcon/);
  assert.doesNotMatch(
    widget,
    /MessageHeader/,
    "chat rows should not render sender names",
  );
  assert.doesNotMatch(
    messageRows,
    /border-primary\/20|bg-primary\/10|border-destructive\/20|bg-destructive\/10/,
    "sender avatars must not diverge by role",
  );
  assert.doesNotMatch(
    messageRows,
    /message\.role === "assistant" \? \(\s*<MessageAvatar/,
    "user messages must not omit their avatar",
  );
  assert.doesNotMatch(
    messageRows,
    /rounded-lg|rounded-2xl|bg-muted\/60|backdrop-blur-xs|shadow-xs/,
    "message bubbles must use the default Bubble surface instead of custom overrides",
  );
  const loadingStateEnd = widget.indexOf("{error ? (", waitingStateStart);
  const loadingState = widget.slice(waitingStateStart, loadingStateEnd);
  assert.match(loadingState, /<Message className="gap-2\.5 px-1 py-1">/);
  assert.match(
    loadingState,
    /<MessageAvatar className=\{CHAT_AVATAR_CLASSNAME\}>/,
  );
  assert.match(loadingState, /<MessageContent className="w-fit">/);
  assert.match(loadingState, /<Marker[\s\S]*role="status"/);
  assert.match(loadingState, /<Spinner[\s\S]*motion-reduce:animate-none/);
  assert.match(loadingState, /t\("chat\.thinking"\)/);
  const errorState = widget.slice(
    loadingStateEnd,
    widget.indexOf("</MessageScrollerContent>", loadingStateEnd),
  );
  assert.match(
    errorState,
    /<MessageAvatar className=\{CHAT_AVATAR_CLASSNAME\}>/,
    "error avatars must use the same circular MessageAvatar treatment",
  );
  const errorAvatarMarkup = errorState.slice(
    errorState.indexOf("<MessageAvatar"),
    errorState.indexOf("</MessageAvatar>") + "</MessageAvatar>".length,
  );
  assert.doesNotMatch(
    errorAvatarMarkup,
    /border-destructive\/20|bg-destructive\/10|text-destructive/,
    "error avatar must reuse the sender avatar style",
  );
  assert.doesNotMatch(errorState, /rounded-2xl/);
  assert.match(errorState, /<div className="flex min-w-0 items-end gap-1\.5">/);
  assert.match(
    errorState,
    /<Bubble variant="destructive" role="alert">[\s\S]*<Button[\s\S]*size="icon-sm"[\s\S]*size-7 shrink-0[\s\S]*chat\.retry[\s\S]*RefreshCcwIcon/,
    "error retry must be an icon button beside the destructive bubble",
  );
  assert.match(errorState, /aria-label=\{t\("chat\.retry"\)\}/);
  assert.match(errorState, /title=\{t\("chat\.retry"\)\}/);
  assert.match(errorState, /onClick=\{\(\) => retryFrom\(failedIndex\)\}/);
  assert.doesNotMatch(
    errorState,
    /<MessageFooter[\s\S]*chat\.retry/,
    "error retry must not render a visible text label or footer",
  );
  assert.doesNotMatch(
    errorState,
    />\s*\{t\("chat\.retry"\)\}\s*<\/Button>/,
    "error retry must not render a visible text label",
  );
  const triggerStart = widget.indexOf("<PopoverTrigger asChild>");
  const triggerEnd = widget.indexOf("</PopoverTrigger>", triggerStart);
  const trigger = widget.slice(triggerStart, triggerEnd);
  assert.match(trigger, /<Button\b/);
  assert.match(trigger, /size="lg"/);
  assert.match(trigger, /h-11/);
  assert.match(trigger, /min-h-11/);
  assert.match(trigger, /w-fit/);
  assert.match(trigger, /max-w-\[calc\(100vw-2rem\)\]/);
  assert.match(trigger, /px-3/);
  assert.match(trigger, /md:h-9 md:min-h-0 md:min-w-(?:\[360px\]|90) md:w-fit/);
  assert.match(trigger, /inset-x-0/);
  assert.match(trigger, /mx-auto/);
  assert.doesNotMatch(trigger, /h-11 w-11/);
  assert.match(
    trigger,
    /flex min-w-0 flex-1 items-center gap-1\.5 whitespace-nowrap/,
    "Sensei label cluster stays on one line across mobile and desktop",
  );
  assert.match(trigger, /RabaLaba/);
  assert.match(
    trigger,
    /<span className="[^\"]*uppercase[^\"]*">\s*RabaLaba/,
    "floating widget brand uses CSS uppercase",
  );
  assert.match(trigger, /<Badge\b/);
  assert.match(trigger, /variant="outline"/);
  assert.match(trigger, /TERMINAL_BADGE_CLASSNAME/);
  assert.match(trigger, /chat\.sensei/);
  assert.doesNotMatch(trigger, /chat\.ask/);
  assert.match(trigger, /className={cn\(\s*"shrink-0"/);
  assert.match(trigger, /<kbd[\s\S]*shortcutHint[\s\S]*<\/kbd>/);
  assert.match(
    widget,
    /const CHAT_KEYCAP_CLASSNAME =\s*"rounded border border-border\/80 bg-background\/60 px-1\.5 py-0\.5 font-mono text-\[10px\] font-medium leading-none text-muted-foreground"/,
  );
  assert.equal(
    widget.match(/className=\{CHAT_KEYCAP_CLASSNAME\}/g)?.length,
    2,
    "both composer keycaps must share one style source",
  );
  assert.match(
    trigger,
    /className=\{cn\([\s\S]*CHAT_KEYCAP_CLASSNAME/,
    "floating widget keycap must reuse the composer keycap style",
  );
  assert.match(trigger, /aria-keyshortcuts="Shift\+\//);
  assert.match(
    trigger,
    /hidden shrink-0 md:ml-auto md:inline-flex/,
  );
  assert.match(trigger, /group-hover:text-white/);
  assert.match(trigger, /group-data-\[state=open\]:text-white/);
  assert.doesNotMatch(
    trigger,
    /group-hover:text-primary|group-data-\[state=open\]:text-primary/,
    "RabaLaba must not switch to the primary color on hover or open",
  );
  assert.doesNotMatch(
    trigger,
    /bg-primary\/15|border-primary\/30|shadow-xs|md:size-8\.5/,
    "Sensei icon must not use the old visual container",
  );
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
  assert.match(
    widget,
    /id="research-copilot-hint"[\s\S]*aria-label=\{t\("chat\.composer_hint"\)\}[\s\S]*flex min-w-0 flex-1 flex-wrap items-center gap-1/,
    "composer hint stays accessible and wraps safely on narrow screens",
  );
  assert.match(widget, /<kbd className=\{CHAT_KEYCAP_CLASSNAME\}>Enter<\/kbd>/);
  assert.match(
    widget,
    /<span>\{t\("chat\.composer_send"\)\}<\/span>/,
  );
  assert.match(
    widget,
    /<kbd className=\{CHAT_KEYCAP_CLASSNAME\}>Shift \+ Enter<\/kbd>/,
  );
  assert.match(
    widget,
    /<span>\{t\("chat\.composer_newline"\)\}<\/span>/,
  );
  for (const openStateToken of [
    "data-[state=open]:-translate-y-0.5",
    "data-[state=open]:bg-card/60",
  ]) {
    assert.ok(
      trigger.includes(openStateToken),
      `Sensei trigger must mirror hover styling while open: ${openStateToken}`,
    );
  }
  assert.doesNotMatch(
    trigger,
    /rotate/,
    "Sensei trigger robot icon must not tilt or rotate",
  );
  assert.match(trigger, /BotIcon/);
  assert.match(trigger, /chat\.open/);
  const panelHeaderStart = widget.indexOf('<CardHeader className="shrink-0');
  const panelHeaderEnd = widget.indexOf("</CardHeader>", panelHeaderStart);
  const panelHeader = widget.slice(panelHeaderStart, panelHeaderEnd);
  assert.match(panelHeader, /<CardTitle className="[^\"]*uppercase[^\"]*">[\s\S]*RabaLaba/);
  assert.match(panelHeader, /<Badge[\s\S]*chat\.sensei/);
  assert.match(panelHeader, /TERMINAL_BADGE_CLASSNAME/);
  assert.doesNotMatch(panelHeader, /chat\.ask(?!_)/);
  assert.match(widget, /event\.code !== "Slash"/);
  assert.match(widget, /!event\.shiftKey/);
  assert.match(widget, /event\.metaKey/);
  assert.match(widget, /event\.ctrlKey/);
  assert.match(widget, /event\.altKey/);
  assert.match(widget, /event\.shiftKey/);
  assert.match(widget, /event\.repeat/);
  assert.match(widget, /target\.isContentEditable/);
  assert.match(widget, /\["INPUT", "TEXTAREA", "SELECT"\]\.includes\(target\.tagName\)/);
  assert.match(widget, /handleOpenChange\(!open\)/);
  assert.match(widget, /setDismissedRequestId\(researchCopilotRequestId\)/);
  assert.doesNotMatch(widget, /setOpen/);
  assert.doesNotMatch(widget, /event\.code !== "Space"|Control\+Shift\+Space Meta\+Shift\+Space/);
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
    /group w-full cursor-pointer select-none rounded-lg border border-border py-0 transition-all duration-200/,
  );
  assert.match(promptSection, /hover:border-primary hover:bg-muted\/50/);
  assert.match(promptSection, /role="button"/);
  assert.match(promptSection, /tabIndex=\{0\}/);
  assert.match(promptSection, /aria-label=\{template\.text\}/);
  assert.match(promptSection, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(promptSection, /template\.accent/);
  assert.match(promptSection, /justify-between/);
  assert.match(promptSection, /min-h-12/);
  assert.match(promptSection, /px-3 py-2/);
  assert.match(promptSection, /md:px-4/);
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
  const widgetWithoutBrandCopy = widget
    .replaceAll(/>\s*RabaLaba\s*<\/span>/g, "></span>")
    .replace(/>\s*RabaLaba\s*<\/CardTitle>/, "></CardTitle>")
    .replaceAll(/>\s*(?:Enter|Shift \+ Enter)\s*<\/kbd>/g, "></kbd>");
  assert.doesNotMatch(
    widgetWithoutBrandCopy,
    />\s*[A-Za-z][^<{]*<\/[A-Za-z]/,
    "visible widget copy must come from translations",
  );

  assert.deepEqual(
    Object.keys(en.chat),
    Object.keys(id.chat),
    "EN/ID chat keys differ",
  );
  assert.equal(en.chat.placeholder, "Ask Sensei…");
  assert.equal(id.chat.placeholder, "Tanya Sensei…");
  assert.equal(en.chat.composer_send, "send");
  assert.equal(id.chat.composer_send, "kirim");
  assert.equal(en.chat.composer_newline, "new line");
  assert.equal(id.chat.composer_newline, "baris baru");
  assert.equal(en.chat.thinking, "Sensei is cooking up some insights…");
  assert.equal(id.chat.thinking, "Sensei lagi ngeracik data…");
  assert.equal(en.chat.shortcut_hint, "Shift + /");
  assert.equal(id.chat.shortcut_hint, "Shift + /");

  const requiredKeys = [
    "title",
    "description",
    "badge",
    "open",
    "shortcut_hint",
    "close",
    "new_chat",
    "empty_title",
    "empty_description",
    "login_title",
    "login_description",
    "loading",
    "sensei",
    "thinking",
    "input_label",
    "placeholder",
    "composer_hint",
    "composer_send",
    "composer_newline",
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
    if (path === "placeholder") continue;
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
