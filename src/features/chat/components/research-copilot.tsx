import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown, { type Components } from "react-markdown";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  BotIcon,
  CheckIcon,
  CopyIcon,
  Clock3Icon,
  Globe2Icon,
  LogInIcon,
  PlusIcon,
  RefreshCcwIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SquareIcon,
  TargetIcon,
  TrendingUpIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { buildLoginRedirect } from "@/lib/auth-redirect";
import { BADGE } from "@/constants/taxonomy/palette";
import { streamChat, type ChatMessage } from "@/features/chat/chat-stream";

type ChatError = "auth" | "input" | "rate" | "unavailable";

const TERMINAL_BADGE_CLASSNAME = cn(
  "rounded-md text-[10px] font-bold uppercase tracking-wider",
  BADGE.accent.bg,
  BADGE.accent.text,
  BADGE.accent.border,
);

const PROMPT_TEMPLATE_CONFIG = [
  {
    key: "thesis",
    icon: TrendingUpIcon,
    accent:
      "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-500/20",
  },
  {
    key: "invalidation",
    icon: TargetIcon,
    accent:
      "text-amber-400 bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-500/20",
  },
  {
    key: "risk",
    icon: ShieldCheckIcon,
    accent:
      "text-primary bg-primary/10 border-primary/20 group-hover:bg-primary/20",
  },
  {
    key: "entry",
    icon: LogInIcon,
    accent:
      "text-primary bg-primary/10 border-primary/20 group-hover:bg-primary/20",
  },
  {
    key: "context",
    icon: Globe2Icon,
    accent:
      "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-500/20",
  },
  {
    key: "management",
    icon: SlidersHorizontalIcon,
    accent:
      "text-amber-400 bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-500/20",
  },
  {
    key: "catalyst",
    icon: ZapIcon,
    accent:
      "text-primary bg-primary/10 border-primary/20 group-hover:bg-primary/20",
  },
  {
    key: "timeframe",
    icon: Clock3Icon,
    accent:
      "text-amber-400 bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-500/20",
  },
] as const;

const CHAT_MARKDOWN_ALLOWED_ELEMENTS = [
  "p",
  "br",
  "strong",
  "em",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "a",
] as const;

const CHAT_MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="text-sm font-semibold leading-snug text-foreground">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold leading-snug text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold leading-snug text-foreground">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc space-y-1.5 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.9em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="max-w-full overflow-x-auto rounded-lg border border-border/60 bg-background/70 p-3 text-[0.9em] leading-relaxed">
      {children}
    </pre>
  ),
  a: ({ children, ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noreferrer"
      className="wrap-break-word text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </a>
  ),
};

function randomPromptTemplates() {
  const accents = [
    ...new Set(PROMPT_TEMPLATE_CONFIG.map(({ accent }) => accent)),
  ];

  return accents.map((accent) => {
    const candidates = PROMPT_TEMPLATE_CONFIG.filter(
      (template) => template.accent === accent,
    );
    return candidates[Math.floor(Math.random() * candidates.length)];
  });
}

function errorKind(error: unknown): ChatError {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number(error.status)
      : 0;
  if (status === 401) return "auth";
  if (status === 400 || status === 413 || status === 415) return "input";
  if (status === 429) return "rate";
  return "unavailable";
}

function ChatSession({ accessToken }: { accessToken: string }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [failedUserId, setFailedUserId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [promptTemplateConfig, setPromptTemplateConfig] = useState(
    randomPromptTemplates,
  );
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function requestAssistant(history: ChatMessage[]) {
    const controller = new AbortController();
    const assistantId = crypto.randomUUID();
    const failedId = history.findLast((message) => message.role === "user")?.id;
    let receivedText = false;

    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setFailedUserId(null);
    setMessages([
      ...history,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      await streamChat(
        history,
        accessToken,
        (text) => {
          receivedText = true;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + text }
                : message,
            ),
          );
        },
        controller.signal,
      );
      if (!receivedText) throw new Error("Empty chat response");
    } catch (requestError) {
      setMessages((current) =>
        current.filter(
          (message) => message.id !== assistantId || message.content,
        ),
      );
      if (!controller.signal.aborted) {
        setError(errorKind(requestError));
        setFailedUserId(failedId ?? null);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;

    const history = [
      ...messages,
      { id: crypto.randomUUID(), role: "user" as const, content },
    ];
    setDraft("");
    void requestAssistant(history);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }

  function newChat() {
    stop();
    setMessages([]);
    setDraft("");
    setError(null);
    setFailedUserId(null);
    setPromptTemplateConfig(randomPromptTemplates());
    inputRef.current?.focus();
  }

  function retryFrom(index: number) {
    if (busy) return;
    let userIndex = index;
    while (userIndex >= 0 && messages[userIndex].role !== "user") {
      userIndex -= 1;
    }
    if (userIndex >= 0) {
      void requestAssistant(messages.slice(0, userIndex + 1));
    }
  }

  async function copyResponse(messageId: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      toast.success(t("chat.copied"));
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error(t("chat.copy_failed"));
    }
  }

  function applyPromptTemplate(text: string) {
    setDraft(text);
    inputRef.current?.focus();
  }

  const promptTemplates = promptTemplateConfig.map((template) => ({
    ...template,
    text: t(`chat.prompts.${template.key}`),
  }));

  const lastMessage = messages.at(-1);
  const waitingForFirstToken =
    busy && lastMessage?.role === "assistant" && !lastMessage?.content;
  const failedIndex = failedUserId
    ? messages.findIndex((message) => message.id === failedUserId)
    : -1;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {messages.length > 0 ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 bg-muted/15 px-4 py-2">
          <div className="flex items-center gap-2">
            <span
              className="size-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
            <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("chat.messages_label")}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 min-h-7 gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:min-h-7"
            disabled={busy}
            onClick={newChat}
          >
            <PlusIcon className="size-3.5" aria-hidden="true" />
            {t("chat.new_chat")}
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <MessageScrollerProvider>
          <MessageScroller aria-busy={busy}>
            <MessageScrollerViewport aria-label={t("chat.messages_label")}>
              <MessageScrollerContent
                className="gap-4 p-4"
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
              >
                {!messages.length && !error ? (
                  <MessageScrollerItem className="my-auto flex min-h-full flex-col justify-center py-2">
                    <Empty className="min-h-full px-1">
                      <EmptyHeader className="w-full items-start space-y-1.5">
                        <div className="w-full space-y-1 text-left">
                          <EmptyTitle className="text-left text-base font-bold tracking-tight leading-snug text-foreground sm:text-lg">
                            {t("chat.empty_title")}
                          </EmptyTitle>
                          <EmptyDescription className="max-w-72 text-left text-xs leading-relaxed text-muted-foreground sm:max-w-85">
                            {t("chat.empty_description")}
                          </EmptyDescription>
                        </div>
                      </EmptyHeader>
                      <EmptyContent className="mt-3 w-full items-stretch gap-2 px-1">
                        {promptTemplates.map((template) => (
                          <Card
                            key={template.key}
                            role="button"
                            tabIndex={0}
                            aria-label={template.text}
                            className="group w-full cursor-pointer select-none border border-border transition-all duration-200 hover:border-primary hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                            onClick={() => applyPromptTemplate(template.text)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                applyPromptTemplate(template.text);
                              }
                            }}
                          >
                            <CardContent className="flex h-full items-center justify-between gap-3 px-4">
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <div
                                  className={cn(
                                    "flex size-7.5 shrink-0 items-center justify-center rounded-lg border transition-colors",
                                    template.accent,
                                  )}
                                >
                                  <template.icon
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                </div>
                                <span className="truncate text-xs font-medium text-foreground/90 group-hover:text-foreground">
                                  {template.text}
                                </span>
                              </div>
                              <ArrowUpRightIcon
                                className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary"
                                aria-hidden="true"
                              />
                            </CardContent>
                          </Card>
                        ))}
                      </EmptyContent>
                    </Empty>
                  </MessageScrollerItem>
                ) : null}

                {messages.map((message, index) =>
                  message.content ? (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={message.role === "user"}
                    >
                      <Message
                        align={message.role === "user" ? "end" : "start"}
                        className="gap-2.5"
                      >
                        {message.role === "assistant" ? (
                          <MessageAvatar className="size-7 shrink-0 rounded-lg border border-primary/20 bg-primary/10 text-primary">
                            <BotIcon className="size-3.5" aria-hidden="true" />
                          </MessageAvatar>
                        ) : null}
                        <MessageContent>
                          <MessageHeader className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                            {message.role === "user"
                              ? t("chat.trader")
                              : t("chat.sensei")}
                          </MessageHeader>
                          <Bubble
                            variant={
                              message.role === "user" ? "default" : "muted"
                            }
                            className={cn(
                              "rounded-2xl transition-all",
                              message.role === "user"
                                ? "rounded-tr-xs bg-primary text-primary-foreground shadow-xs font-normal"
                                : "rounded-tl-xs border border-border/60 bg-muted/60 text-foreground shadow-xs backdrop-blur-xs",
                            )}
                          >
                            <BubbleContent className="min-w-0 wrap-break-word px-3.5 py-2.5 text-xs leading-relaxed sm:text-sm sm:leading-relaxed">
                              {message.role === "assistant" ? (
                                <div className="space-y-2 wrap-break-word">
                                  <ReactMarkdown
                                    skipHtml
                                    allowedElements={
                                      CHAT_MARKDOWN_ALLOWED_ELEMENTS
                                    }
                                    components={CHAT_MARKDOWN_COMPONENTS}
                                  >
                                    {message.content}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <span className="whitespace-pre-wrap wrap-break-word">
                                  {message.content}
                                </span>
                              )}
                            </BubbleContent>
                          </Bubble>
                          {message.role === "assistant" ? (
                            <MessageFooter className="gap-1 pt-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-7 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:size-7"
                                aria-label={t("chat.copy")}
                                title={t("chat.copy")}
                                onClick={() =>
                                  void copyResponse(message.id, message.content)
                                }
                              >
                                {copiedId === message.id ? (
                                  <CheckIcon
                                    className="size-3.5 text-emerald-500"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <CopyIcon
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                )}
                              </Button>
                              {index === messages.length - 1 &&
                              !busy &&
                              !error ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-7 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:size-7"
                                  aria-label={t("chat.retry")}
                                  title={t("chat.retry")}
                                  onClick={() => retryFrom(index)}
                                >
                                  <RefreshCcwIcon
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                </Button>
                              ) : null}
                            </MessageFooter>
                          ) : null}
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  ) : null,
                )}

                {waitingForFirstToken ? (
                  <MessageScrollerItem>
                    <div className="flex items-center gap-2.5 px-1 py-1">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                        <BotIcon className="size-3.5" aria-hidden="true" />
                      </div>
                      <Marker
                        role="status"
                        className="rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                      >
                        <MarkerIcon>
                          <Spinner
                            aria-hidden="true"
                            className="size-3.5 text-primary motion-reduce:animate-none"
                          />
                        </MarkerIcon>
                        <MarkerContent className="text-xs font-medium">
                          {t("chat.thinking")}
                        </MarkerContent>
                      </Marker>
                    </div>
                  </MessageScrollerItem>
                ) : null}

                {error ? (
                  <MessageScrollerItem>
                    <Message className="gap-2.5">
                      <MessageAvatar className="size-7 shrink-0 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive">
                        <BotIcon className="size-3.5" aria-hidden="true" />
                      </MessageAvatar>
                      <MessageContent>
                        <Bubble
                          variant="destructive"
                          role="alert"
                          className="rounded-2xl rounded-tl-xs"
                        >
                          <BubbleContent className="px-3.5 py-2.5 text-xs leading-relaxed sm:text-sm">
                            {t(`chat.errors.${error}`)}
                          </BubbleContent>
                        </Bubble>
                        {failedIndex >= 0 ? (
                          <MessageFooter className="gap-1 pt-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 min-h-7 gap-1.5 rounded-md px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive sm:min-h-0"
                              onClick={() => retryFrom(failedIndex)}
                            >
                              <RefreshCcwIcon
                                className="size-3.5"
                                aria-hidden="true"
                              />
                              {t("chat.retry")}
                            </Button>
                          </MessageFooter>
                        ) : null}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ) : null}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton
              className="size-10 rounded-full border border-border/80 bg-background/90 text-foreground shadow-md backdrop-blur-xs sm:size-7"
              aria-label={t("chat.scroll_latest")}
            >
              <ArrowDownIcon aria-hidden="true" />
            </MessageScrollerButton>
          </MessageScroller>
        </MessageScrollerProvider>
      </div>

      <form
        className="w-full shrink-0 border-t border-border bg-card px-3.5 py-3 sm:px-4 sm:py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3"
        aria-busy={busy}
        onSubmit={handleSubmit}
      >
        <FieldGroup className="gap-1.5">
          <Field>
            <FieldLabel htmlFor="research-copilot-input" className="sr-only">
              {t("chat.input_label")}
            </FieldLabel>
            <InputGroup className="rounded-xl border border-border bg-card shadow-xs transition-all focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
              <InputGroupTextarea
                ref={inputRef}
                id="research-copilot-input"
                rows={1}
                maxLength={2_000}
                className="max-h-32 min-h-10 overflow-y-auto px-3.5 py-2 text-sm leading-relaxed"
                placeholder={t("chat.placeholder")}
                aria-describedby="research-copilot-hint"
                value={draft}
                disabled={busy}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
              />
              <InputGroupAddon
                align="block-end"
                className="flex items-center justify-between w-full border-t border-border px-3 py-1.5"
              >
                <InputGroupText
                  id="research-copilot-hint"
                  className="sr-only text-[11px] text-muted-foreground/70 sm:not-sr-only sm:flex"
                >
                  {t("chat.composer_hint")}
                </InputGroupText>
                {busy ? (
                  <InputGroupButton
                    type="button"
                    size="icon-sm"
                    className="ml-auto flex size-8 items-center justify-center rounded-lg p-0 bg-destructive/10 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground sm:size-8"
                    aria-label={t("chat.stop")}
                    title={t("chat.stop")}
                    onClick={stop}
                  >
                    <SquareIcon className="size-3.5" aria-hidden="true" />
                  </InputGroupButton>
                ) : (
                  <InputGroupButton
                    type="submit"
                    variant="default"
                    size="icon-sm"
                    className="ml-auto flex size-8 items-center justify-center rounded-lg p-0 bg-primary text-primary-foreground shadow-xs transition-transform hover:bg-primary/90 active:scale-95 disabled:opacity-40 motion-reduce:transform-none sm:size-8"
                    disabled={!draft.trim()}
                    aria-label={t("chat.send")}
                    title={t("chat.send")}
                  >
                    <ArrowUpIcon className="size-4" aria-hidden="true" />
                  </InputGroupButton>
                )}
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}

export function ResearchCopilot() {
  const { t } = useTranslation();
  const location = useLocation();
  const { session, user, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const loginPath = buildLoginRedirect(
    location.pathname,
    location.search,
    location.hash,
  );

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          className="group fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex min-h-11 items-center gap-2 rounded-full border border-primary/40 bg-card/90 px-3.5 py-2 text-xs font-semibold text-foreground shadow-xl backdrop-blur-md transition-all duration-200 hover:border-primary hover:bg-card hover:shadow-2xl hover:shadow-primary/20 active:scale-95 motion-reduce:transform-none motion-reduce:transition-none sm:right-6 sm:px-4 sm:text-sm md:bottom-6"
          aria-label={t("chat.open")}
          title={t("chat.open")}
        >
          <div className="relative flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <BotIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="absolute -top-0.5 -right-0.5 flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
          </div>
          <span className="hidden font-medium tracking-tight whitespace-nowrap sm:inline">
            {t("chat.title")}
          </span>
          <Badge
            variant="outline"
            className={cn("hidden sm:inline-flex", TERMINAL_BADGE_CLASSNAME)}
          >
            {t("chat.badge")}
          </Badge>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        forceMount
        side="top"
        align="end"
        sideOffset={12}
        collisionPadding={12}
        aria-label={t("chat.title")}
        aria-hidden={!open}
        onOpenAutoFocus={(event) => {
          const input = document.getElementById("research-copilot-input");
          if (input instanceof HTMLTextAreaElement) {
            event.preventDefault();
            input.focus({ preventScroll: true });
          }
        }}
        className={cn(
          "w-[min(460px,calc(100vw-1rem))] max-h-[calc(100dvh-9.5rem-env(safe-area-inset-bottom))] max-w-none overflow-visible border-0 bg-transparent p-0 shadow-none ring-0 transition-[opacity,transform] duration-200 ease-out motion-reduce:animate-none motion-reduce:transition-none sm:max-h-[calc(100dvh-6.5rem)]",
          !open && "invisible pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <Card
          id="rabalaba-sensei-panel"
          className="flex h-[min(680px,calc(100dvh-9.5rem-env(safe-area-inset-bottom)))] max-h-[calc(100dvh-9.5rem-env(safe-area-inset-bottom))] min-h-0 flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card py-0 shadow-2xl transition-all sm:h-[min(720px,calc(100dvh-6.5rem))] sm:max-h-none"
        >
          <CardHeader className="shrink-0 border-b border-border bg-card px-4 py-3 sm:px-5 sm:py-3.5">
            <div className="flex items-center gap-3">
              <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-inner">
                <BotIcon className="size-4.5" aria-hidden="true" />
                <span className="absolute -top-0.5 -right-0.5 flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full border border-card bg-emerald-500" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="truncate text-base font-bold tracking-tight text-foreground leading-snug">
                    {t("chat.title")}
                  </CardTitle>
                  <Badge variant="outline" className={TERMINAL_BADGE_CLASSNAME}>
                    {t("chat.badge")}
                  </Badge>
                </div>
                <CardDescription className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {t("chat.description")}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-8 shrink-0 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={t("chat.close")}
                title={t("chat.close")}
                onClick={() => setOpen(false)}
              >
                <XIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            {!ready ? (
              <div className="flex h-full items-center justify-center">
                <Spinner
                  aria-label={t("chat.loading")}
                  className="motion-reduce:animate-none"
                />
              </div>
            ) : session && user ? (
              <ChatSession key={user.id} accessToken={session.access_token} />
            ) : (
              <Empty className="h-full px-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BotIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{t("chat.login_title")}</EmptyTitle>
                  <EmptyDescription>
                    {t("chat.login_description")}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild className="min-h-11">
                    <Link to={loginPath}>{t("common.actions.login")}</Link>
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
