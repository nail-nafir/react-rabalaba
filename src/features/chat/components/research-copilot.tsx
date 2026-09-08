import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BotIcon,
  CopyIcon,
  PlusIcon,
  RefreshCcwIcon,
  SquareIcon,
  XIcon,
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
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { buildLoginRedirect } from "@/lib/auth-redirect";
import { BADGE } from "@/constants/taxonomy/palette";
import {
  streamChat,
  type ChatMessage,
} from "@/features/chat/chat-stream";

type ChatError = "auth" | "input" | "rate" | "unavailable";

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
    setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);

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

  async function copyResponse(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast.success(t("chat.copied"));
    } catch {
      toast.error(t("chat.copy_failed"));
    }
  }

  const prompts = [
    t("chat.prompts.thesis"),
    t("chat.prompts.invalidation"),
    t("chat.prompts.risk"),
  ];
  const waitingForFirstToken =
    busy &&
    messages.at(-1)?.role === "assistant" &&
    !messages.at(-1)?.content;
  const failedIndex = failedUserId
    ? messages.findIndex((message) => message.id === failedUserId)
    : -1;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 sm:min-h-0"
          disabled={!messages.length && !busy}
          onClick={newChat}
        >
          <PlusIcon data-icon="inline-start" />
          {t("chat.new_chat")}
        </Button>
      </div>
      <Separator />

      <div className="min-h-0 flex-1 overflow-hidden">
        <MessageScrollerProvider>
          <MessageScroller aria-busy={busy}>
            <MessageScrollerViewport>
              <MessageScrollerContent
                className="p-4"
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
              >
                {!messages.length && !error ? (
                  <MessageScrollerItem className="flex min-h-full">
                    <Empty className="min-h-full px-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <BotIcon />
                        </EmptyMedia>
                        <EmptyTitle>{t("chat.empty_title")}</EmptyTitle>
                        <EmptyDescription>
                          {t("chat.empty_description")}
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent className="items-stretch">
                        {prompts.map((prompt) => (
                          <Button
                            key={prompt}
                            type="button"
                            variant="outline"
                            className="h-auto min-h-11 justify-start whitespace-normal text-left"
                            onClick={() => {
                              setDraft(prompt);
                              inputRef.current?.focus();
                            }}
                          >
                            {prompt}
                          </Button>
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
                      <Message align={message.role === "user" ? "end" : "start"}>
                        <MessageContent>
                          <MessageHeader>
                            {message.role === "user"
                              ? t("chat.you")
                              : t("chat.assistant")}
                          </MessageHeader>
                          <Bubble
                            variant={message.role === "user" ? "default" : "muted"}
                          >
                            <BubbleContent>
                              <span className="whitespace-pre-wrap">
                                {message.content}
                              </span>
                            </BubbleContent>
                          </Bubble>
                          {message.role === "assistant" ? (
                            <MessageFooter className="gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-11 sm:size-7"
                                aria-label={t("chat.copy")}
                                title={t("chat.copy")}
                                onClick={() => void copyResponse(message.content)}
                              >
                                <CopyIcon data-icon="inline-start" />
                              </Button>
                              {index === messages.length - 1 && !busy && !error ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-11 sm:size-7"
                                  aria-label={t("chat.retry")}
                                  title={t("chat.retry")}
                                  onClick={() => retryFrom(index)}
                                >
                                  <RefreshCcwIcon data-icon="inline-start" />
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
                    <Marker role="status">
                      <MarkerIcon>
                        <Spinner
                          aria-hidden="true"
                          className="motion-reduce:animate-none"
                        />
                      </MarkerIcon>
                      <MarkerContent>{t("chat.thinking")}</MarkerContent>
                    </Marker>
                  </MessageScrollerItem>
                ) : null}

                {error ? (
                  <MessageScrollerItem>
                    <Message>
                      <MessageContent>
                        <Bubble variant="destructive">
                          <BubbleContent>
                            <span role="alert">{t(`chat.errors.${error}`)}</span>
                          </BubbleContent>
                        </Bubble>
                        {failedIndex >= 0 ? (
                          <MessageFooter>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="min-h-11 sm:min-h-0"
                              onClick={() => retryFrom(failedIndex)}
                            >
                              <RefreshCcwIcon data-icon="inline-start" />
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
            <MessageScrollerButton aria-label={t("chat.scroll_latest")}>
              <ArrowDownIcon data-icon="inline-start" />
            </MessageScrollerButton>
          </MessageScroller>
        </MessageScrollerProvider>
      </div>

      <Separator />
      <form
        className="shrink-0 w-full p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4"
        aria-busy={busy}
        onSubmit={handleSubmit}
      >
        <FieldGroup className="gap-2">
          <Field>
            <FieldLabel htmlFor="research-copilot-input" className="sr-only">
              {t("chat.input_label")}
            </FieldLabel>
            <InputGroup>
              <InputGroupTextarea
                ref={inputRef}
                id="research-copilot-input"
                rows={1}
                maxLength={2_000}
                className="max-h-32 min-h-12 overflow-y-auto"
                placeholder={t("chat.placeholder")}
                value={draft}
                disabled={busy}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
              />
              <InputGroupAddon align="block-end" className="p-1.5">
                <InputGroupText className="hidden text-xs sm:flex">
                  {t("chat.composer_hint")}
                </InputGroupText>
                {busy ? (
                  <InputGroupButton
                    type="button"
                    size="icon-sm"
                    className="ml-auto size-8 shrink-0"
                    aria-label={t("chat.stop")}
                    title={t("chat.stop")}
                    onClick={stop}
                  >
                    <SquareIcon data-icon="inline-start" />
                  </InputGroupButton>
                ) : (
                  <InputGroupButton
                    type="submit"
                    variant="default"
                    size="icon-sm"
                    className="ml-auto size-8 shrink-0"
                    disabled={!draft.trim()}
                    aria-label={t("chat.send")}
                    title={t("chat.send")}
                  >
                    <ArrowUpIcon data-icon="inline-start" />
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
    <>
      <Card
        id="rabalaba-sensei-panel"
        aria-hidden={!open}
        className={`fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex h-[min(720px,calc(100dvh-6rem))] min-h-0 flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 shadow-2xl shadow-black/30 ring-1 ring-foreground/10 transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[min(440px,calc(100vw-3rem))] ${
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible pointer-events-none translate-y-3 opacity-0"
        }`}
      >
          <CardHeader className="shrink-0 bg-popover p-4 pb-0">
            <div className="flex items-start gap-3">
              <Avatar className="size-10 border border-primary/30 bg-primary/10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <BotIcon className="size-5" aria-hidden="true" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="truncate text-base">
                    {t("chat.title")}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      "w-fit shrink-0 rounded-md text-[10px] font-bold uppercase tracking-wider",
                      BADGE.accent.bg,
                      BADGE.accent.text,
                      BADGE.accent.border,
                    )}
                  >
                    AI
                  </Badge>
                </div>
                <CardDescription className="mt-1 text-xs leading-relaxed">
                  {t("chat.description")}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-11 shrink-0 sm:size-8"
                aria-label={t("chat.close")}
                title={t("chat.close")}
                onClick={() => setOpen(false)}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
            <Separator className="mt-4" />
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
                    <BotIcon />
                  </EmptyMedia>
                  <EmptyTitle>{t("chat.login_title")}</EmptyTitle>
                  <EmptyDescription>{t("chat.login_description")}</EmptyDescription>
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

      <Button
        type="button"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 h-11 rounded-full px-3 text-xs font-semibold shadow-lg transition-transform duration-200 ease-out hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:px-4 sm:text-sm md:bottom-6"
        aria-label={t("chat.open")}
        title={t("chat.open")}
        aria-expanded={open}
        aria-controls="rabalaba-sensei-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <BotIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">{t("chat.title")}</span>
      </Button>
    </>
  );
}
