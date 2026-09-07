import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BADGE, PALETTE } from "@/constants/taxonomy/palette";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "../types/learn";
import { PatternVisual } from "./pattern-visual";
import { QUIZ_QUESTIONS } from "../data/quiz-data";
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  RotateCcw,
  Trophy,
  BarChart3,
  Play,
  LayoutGrid,
  ShieldCheck,
  Award,
  TrendingUp,
  Activity,
} from "lucide-react";

const QUIZ_SAMPLE_SIZE = 5;
const QUESTION_TIME_LIMIT = 30; // 30 seconds per question

function getRandomQuestions(sampleSize = QUIZ_SAMPLE_SIZE): QuizQuestion[] {
  const shuffled = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, sampleSize).map((q) => ({
    ...q,
    options: [...q.options].sort(() => Math.random() - 0.5),
  }));
}

interface AnswerRecord {
  question: QuizQuestion;
  selectedOptionId: string | null;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

const QuizSessionContent: React.FC = () => {
  const { t } = useTranslation();

  const [questions, setQuestions] = useState<QuizQuestion[]>(() =>
    getRandomQuestions(),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(QUESTION_TIME_LIMIT);

  const currentQ = questions[currentIndex] ?? questions[0];
  const totalQuestions = questions.length;
  const questionKey = `learn.quiz.questions.${currentQ.id}`;

  const handleTimeOut = useCallback(() => {
    setIsAnswered(true);
    setSelectedOptionId(null);
    setAnswers((prev) => [
      ...prev,
      {
        question: currentQ,
        selectedOptionId: null,
        isCorrect: false,
        timeSpentSeconds: QUESTION_TIME_LIMIT,
      },
    ]);
  }, [currentQ]);

  // Live Countdown Timer Effect (runs actively when taking quiz)
  useEffect(() => {
    if (isCompleted || isAnswered) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [currentIndex, isAnswered, isCompleted, handleTimeOut]);

  const handleSelectOption = (optionId: string, isCorrect: boolean) => {
    if (isAnswered) return;

    const timeSpent = Math.max(1, QUESTION_TIME_LIMIT - timeLeft);
    setSelectedOptionId(optionId);
    setIsAnswered(true);

    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
    setAnswers((prev) => [
      ...prev,
      {
        question: currentQ,
        selectedOptionId: optionId,
        isCorrect,
        timeSpentSeconds: timeSpent,
      },
    ]);
  };

  const handleNext = () => {
    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOptionId(null);
      setIsAnswered(false);
      setTimeLeft(QUESTION_TIME_LIMIT);
    } else {
      setIsCompleted(true);
    }
  };

  const handleRestart = () => {
    setQuestions(getRandomQuestions());
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setIsAnswered(false);
    setIsCompleted(false);
    setScore(0);
    setAnswers([]);
    setTimeLeft(QUESTION_TIME_LIMIT);
  };

  const scorePercentage = Math.round((score / totalQuestions) * 100);

  // Compute Average Response Time
  const totalSecondsSpent = answers.reduce(
    (acc, curr) => acc + curr.timeSpentSeconds,
    0,
  );
  const avgSeconds = (
    totalSecondsSpent / (answers.length || totalQuestions)
  ).toFixed(1);

  const { rankKey, gradeLetter, gradeBadge } = (() => {
    if (scorePercentage === 100) {
      return {
        rankKey: "master",
        gradeLetter: "A+",
        gradeBadge: BADGE.positive,
      };
    }
    if (scorePercentage >= 80) {
      return {
        rankKey: "master",
        gradeLetter: "A",
        gradeBadge: BADGE.positive,
      };
    }
    if (scorePercentage >= 60) {
      return {
        rankKey: "proficient",
        gradeLetter: "B",
        gradeBadge: BADGE.accent,
      };
    }
    return {
      rankKey: "apprentice",
      gradeLetter: "D",
      gradeBadge: BADGE.negative,
    };
  })();

  const diffBadge = (() => {
    switch (currentQ.difficulty) {
      case "beginner":
        return BADGE.positive;
      case "intermediate":
        return BADGE.warning;
      case "advanced":
        return BADGE.negative;
      default:
        return BADGE.neutral;
    }
  })();

  const accuracyMetricBadge = (() => {
    if (scorePercentage >= 80) {
      return {
        label: t("learn.quiz_ui.metrics_badge.optimal"),
        badge: BADGE.positive,
      };
    }
    if (scorePercentage >= 60) {
      return {
        label: t("learn.quiz_ui.metrics_badge.moderate"),
        badge: BADGE.neutral,
      };
    }
    return {
      label: t("learn.quiz_ui.metrics_badge.subpar"),
      badge: BADGE.negative,
    };
  })();

  const speedMetricBadge = (() => {
    const sec = Number(avgSeconds);
    if (sec <= 5) {
      return {
        label: t("learn.quiz_ui.metrics_badge.fast"),
        badge: BADGE.positive,
      };
    }
    if (sec <= 15) {
      return {
        label: t("learn.quiz_ui.metrics_badge.balanced"),
        badge: BADGE.neutral,
      };
    }
    return {
      label: t("learn.quiz_ui.metrics_badge.cautious"),
      badge: BADGE.warning,
    };
  })();

  const selectedOpt = currentQ.options.find((o) => o.id === selectedOptionId);

  return (
    <>
      {/* Header styled identically to pattern detail dialog */}
      <DialogHeader className="shrink-0 bg-popover p-4 pb-0">
        <DialogTitle className="text-lg font-bold tracking-tight text-foreground uppercase flex items-center gap-2 flex-wrap pr-6">
          <span>{t("learn.quiz_ui.title")}</span>
          {!isCompleted ? (
            <Badge
              variant="outline"
              className={cn(
                "font-bold uppercase tracking-wider text-[10px] rounded-md",
                BADGE.neutral.bg,
                BADGE.neutral.text,
                BADGE.neutral.border,
              )}
            >
              {t("learn.quiz_ui.progress", {
                current: currentIndex + 1,
                total: totalQuestions,
              })}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className={cn(
                "font-bold tracking-wider uppercase text-[10px] rounded-md",
                BADGE.positive.bg,
                BADGE.positive.text,
                BADGE.positive.border,
              )}
            >
              {t("learn.quiz_ui.completed")}
            </Badge>
          )}
        </DialogTitle>

        <div className="space-y-0.5 mt-1">
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {isCompleted
              ? t("learn.quiz_ui.completed_description")
              : t("learn.quiz_ui.start_subtitle")}
          </DialogDescription>
        </div>

        {/* Meta badges */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {!isCompleted ? (
            <>
              <Badge
                variant="outline"
                className={cn(
                  "font-bold uppercase tracking-wider text-[10px] rounded-md",
                  diffBadge.bg,
                  diffBadge.text,
                  diffBadge.border,
                )}
              >
                {t(`learn.common.difficulty.${currentQ.difficulty}`)}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "font-bold uppercase tracking-wider text-[10px] rounded-md",
                  BADGE.neutral.bg,
                  BADGE.neutral.text,
                  BADGE.neutral.border,
                )}
              >
                {t(`learn.quiz_ui.categories.${currentQ.category}`)}
              </Badge>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={cn(
                  "font-bold uppercase tracking-wider text-[10px] rounded-md",
                  gradeBadge.bg,
                  gradeBadge.text,
                  gradeBadge.border,
                )}
              >
                {t("learn.quiz_ui.grade_badge", {
                  grade: gradeLetter,
                  score: scorePercentage,
                })}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "font-bold uppercase tracking-wider text-[10px] rounded-md",
                  gradeBadge.bg,
                  gradeBadge.text,
                  gradeBadge.border,
                )}
              >
                {t(`learn.quiz_ui.ranks.${rankKey}`)}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "font-bold uppercase tracking-wider text-[10px] rounded-md",
                  BADGE.neutral.bg,
                  BADGE.neutral.text,
                  BADGE.neutral.border,
                )}
              >
                {t("learn.quiz_ui.correct_questions_count", {
                  score,
                  total: totalQuestions,
                })}
              </Badge>
            </div>
          )}
        </div>

        <Separator className="mt-4" />
      </DialogHeader>

      {/* Scrollable Content Body */}
      <div className="flex-1 min-h-0 flex flex-col space-y-6 p-4 overflow-y-auto">
        {isCompleted ? (
          /* Completion Scorecard Screen */
          <div className="space-y-6 w-full">
            {/* Hero Competency Scorecard Banner */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  {t("learn.quiz_ui.scorecard")}
                </h3>
              </div>

              <Card className="border border-border bg-muted/50">
                <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-bold uppercase tracking-wider text-[10px] rounded-md",
                          BADGE.neutral.bg,
                          BADGE.neutral.text,
                          BADGE.neutral.border,
                        )}
                      >
                        {t("learn.quiz_ui.completed")}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-bold uppercase tracking-wider text-[10px] rounded-md",
                          gradeBadge.bg,
                          gradeBadge.text,
                          gradeBadge.border,
                        )}
                      >
                        {t(`learn.quiz_ui.ranks.${rankKey}`)}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t("learn.quiz_ui.completed_description")}
                    </p>
                  </div>

                  <div className="shrink-0 flex flex-wrap items-center justify-end gap-2 pt-2 sm:pt-0">
                    <Button
                      size="lg"
                      className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight"
                      onClick={handleRestart}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{t("learn.quiz_ui.retake")}</span>
                    </Button>
                    <DialogClose asChild>
                      <Button
                        variant="secondary"
                        size="lg"
                        className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight"
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span>{t("learn.quiz_ui.menu_lobby")}</span>
                      </Button>
                    </DialogClose>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* 4 Metric Performance Dashboard */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  {t("learn.quiz_ui.metrics_title")}
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border border-border bg-muted/50">
                  <CardContent className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        {t("learn.quiz_ui.accuracy")}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-bold uppercase tracking-wider text-[10px] rounded-md",
                          accuracyMetricBadge.badge.bg,
                          accuracyMetricBadge.badge.text,
                          accuracyMetricBadge.badge.border,
                        )}
                      >
                        {accuracyMetricBadge.label}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black text-foreground">
                        {scorePercentage}%
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                        {t("learn.quiz_ui.correct_questions_count", {
                          score,
                          total: totalQuestions,
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-muted/50">
                  <CardContent className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        {t("learn.quiz_ui.total_score")}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-bold uppercase tracking-wider text-[10px] rounded-md",
                          BADGE.neutral.bg,
                          BADGE.neutral.text,
                          BADGE.neutral.border,
                        )}
                      >
                        {t("learn.quiz_ui.badge_questions")}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black text-primary">
                        {score} / {totalQuestions}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                        {t("learn.quiz_ui.accumulated_points")}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-muted/50">
                  <CardContent className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        {t("learn.quiz_ui.execution_speed")}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-bold uppercase tracking-wider text-[10px] rounded-md",
                          speedMetricBadge.badge.bg,
                          speedMetricBadge.badge.text,
                          speedMetricBadge.badge.border,
                        )}
                      >
                        {speedMetricBadge.label}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black text-foreground">
                        {t("learn.quiz_ui.seconds_value", {
                          count: avgSeconds,
                        })}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                        {t("learn.quiz_ui.speed_desc")}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-muted/50">
                  <CardContent className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        {t("learn.quiz_ui.status")}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-bold uppercase tracking-wider text-[10px] rounded-md",
                          gradeBadge.bg,
                          gradeBadge.text,
                          gradeBadge.border,
                        )}
                      >
                        {t("learn.quiz_ui.grade_letter", {
                          grade: gradeLetter,
                        })}
                      </Badge>
                    </div>
                    <div>
                      <div
                        className={cn(
                          "text-base sm:text-lg font-bold",
                          scorePercentage >= 60
                            ? PALETTE.positive.text
                            : PALETTE.negative.text,
                        )}
                      >
                        {scorePercentage >= 60
                          ? t("learn.quiz_ui.passed")
                          : t("learn.quiz_ui.needs_study")}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                        {t("learn.quiz_ui.competency_standard")}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Separator />

            {/* Granular Audit Breakdown of All Questions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  {t("learn.quiz_ui.review_title")}
                </h3>
              </div>

              <div className="space-y-3">
                {answers.map((ans, idx) => {
                  const qKey = `learn.quiz.questions.${ans.question.id}`;
                  const optKey = ans.selectedOptionId
                    ? `${qKey}.options.${ans.selectedOptionId}`
                    : null;

                  const questionDiffBadge = (() => {
                    switch (ans.question.difficulty) {
                      case "beginner":
                        return BADGE.positive;
                      case "intermediate":
                        return BADGE.warning;
                      case "advanced":
                        return BADGE.negative;
                      default:
                        return BADGE.neutral;
                    }
                  })();

                  return (
                    <Card
                      key={ans.question.id}
                      className={cn(
                        "border border-border bg-muted/50",
                        !ans.isCorrect && "border-rose-500/30 bg-rose-500/5",
                      )}
                    >
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-bold uppercase tracking-wider text-[10px] rounded-md",
                                BADGE.neutral.bg,
                                BADGE.neutral.text,
                                BADGE.neutral.border,
                              )}
                            >
                              {t("learn.quiz_ui.question_number", {
                                number: idx + 1,
                              })}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-bold uppercase tracking-wider text-[10px] rounded-md",
                                BADGE.neutral.bg,
                                BADGE.neutral.text,
                                BADGE.neutral.border,
                              )}
                            >
                              {t(
                                `learn.quiz_ui.categories.${ans.question.category}`,
                              )}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-bold uppercase tracking-wider text-[10px] rounded-md",
                                questionDiffBadge.bg,
                                questionDiffBadge.text,
                                questionDiffBadge.border,
                              )}
                            >
                              {t(
                                `learn.common.difficulty.${ans.question.difficulty}`,
                              )}
                            </Badge>
                          </div>

                          <Badge
                            variant="outline"
                            className={cn(
                              "font-bold uppercase tracking-wider text-[10px] rounded-md",
                              ans.isCorrect
                                ? cn(
                                    BADGE.positive.bg,
                                    BADGE.positive.text,
                                    BADGE.positive.border,
                                  )
                                : cn(
                                    BADGE.negative.bg,
                                    BADGE.negative.text,
                                    BADGE.negative.border,
                                  ),
                            )}
                          >
                            {ans.isCorrect
                              ? t("learn.quiz_ui.correct_action")
                              : t("learn.quiz_ui.incorrect_action")}
                          </Badge>
                        </div>

                        {/* Question Title & Prompt */}
                        <div className="space-y-1">
                          <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                            {t(`${qKey}.title`)}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {t(`${qKey}.question`)}
                          </p>
                        </div>

                        {/* User's Choice & Explanation Box */}
                        <Card
                          className={cn(
                            "border text-xs",
                            ans.isCorrect
                              ? cn(BADGE.positive.border, BADGE.positive.bg)
                              : cn(BADGE.negative.border, BADGE.negative.bg),
                          )}
                        >
                          <CardContent className="space-y-1">
                            <CardTitle
                              className={cn(
                                "text-xs font-bold uppercase tracking-wider",
                                ans.isCorrect
                                  ? PALETTE.positive.text
                                  : PALETTE.negative.text,
                              )}
                            >
                              {t("learn.quiz_ui.your_choice")}{" "}
                              {optKey
                                ? t(`${optKey}.text`)
                                : t("learn.quiz_ui.incorrect_action")}
                            </CardTitle>
                            {optKey && (
                              <p className="text-xs text-foreground/90 leading-relaxed font-normal">
                                {t(`${optKey}.explanation`)}
                              </p>
                            )}
                          </CardContent>
                        </Card>

                        {/* Key Pro Tip Takeaway */}
                        <div className="pt-2 border-t border-border/40 space-y-1">
                          <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                            {t("learn.quiz_ui.takeaway")}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {t(`${qKey}.pro_tip`)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Main 2-Column Quiz Layout */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 items-start">
            {/* Left Column: Candle Visual & Question Narrative */}
            <div className="space-y-4">
              {/* Technical Chart Arena with Dashed Guidelines */}
              <Card className="relative border border-border bg-muted/50 flex flex-col items-center justify-center overflow-hidden">
                {/* Standard dashed technical grid lines */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none opacity-40 flex flex-col justify-around px-4 py-8"
                >
                  <div className="border-b border-dashed border-muted-foreground/30 w-full" />
                  <div className="border-b border-dashed border-muted-foreground/30 w-full" />
                  <div className="border-b border-dashed border-muted-foreground/30 w-full" />
                </div>

                <CardContent className="relative z-10 flex flex-col items-center justify-center w-full">
                  <PatternVisual
                    type={currentQ.svgType}
                    className="w-full max-w-lg h-48"
                  />
                </CardContent>
              </Card>

              {/* Question Narrative Box */}
              <Card className="border border-border bg-muted/50">
                <CardContent className="space-y-1">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {t(`${questionKey}.title`)}
                  </CardTitle>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t(`${questionKey}.question`)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Execution Terminal & Decision Buttons */}
            <div className="space-y-4">
              {/* Score & Live Timer Card */}
              <Card className="border border-border bg-muted/50">
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                    <span className="text-foreground">
                      {t("learn.quiz_ui.current_score", { score })}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-bold tracking-wider uppercase text-[10px] rounded-md transition-colors duration-200",
                        timeLeft > 10
                          ? cn(
                              BADGE.positive.bg,
                              BADGE.positive.text,
                              BADGE.positive.border,
                            )
                          : timeLeft > 5
                            ? cn(
                                BADGE.warning.bg,
                                BADGE.warning.text,
                                BADGE.warning.border,
                              )
                            : cn(
                                BADGE.negative.bg,
                                BADGE.negative.text,
                                BADGE.negative.border,
                                "animate-pulse",
                              ),
                      )}
                    >
                      {t("learn.quiz_ui.seconds_value", { count: timeLeft })}
                    </Badge>
                  </div>

                  {/* Timer Countdown Bar */}
                  <Progress
                    value={(timeLeft / QUESTION_TIME_LIMIT) * 100}
                    className={cn(
                      "h-1.5 [&>div]:duration-1000 [&>div]:ease-linear",
                      timeLeft > 10
                        ? "[&>div]:bg-emerald-500"
                        : timeLeft > 5
                          ? "[&>div]:bg-amber-500"
                          : "[&>div]:bg-rose-500 [&>div]:animate-pulse",
                    )}
                  />
                </CardContent>
              </Card>

              {/* Multiple Choice Options List */}
              <div className="space-y-2">
                {currentQ.options.map((opt) => {
                  const optionKey = `${questionKey}.options.${opt.id}`;
                  const isSelected = selectedOptionId === opt.id;
                  const cardState = isAnswered
                    ? opt.isCorrect
                      ? cn(
                          BADGE.positive.border,
                          BADGE.positive.bg,
                          "ring-1 ring-emerald-500/50",
                        )
                      : isSelected
                        ? cn(
                            BADGE.negative.border,
                            BADGE.negative.bg,
                            "ring-1 ring-rose-500/50",
                          )
                        : "border-border/40 opacity-40 bg-muted/20 text-muted-foreground"
                    : "hover:bg-muted/80 hover:border-primary/50 cursor-pointer";

                  return (
                    <Card
                      key={opt.id}
                      onClick={() =>
                        !isAnswered && handleSelectOption(opt.id, opt.isCorrect)
                      }
                      onKeyDown={(e) => {
                        if (
                          !isAnswered &&
                          (e.key === "Enter" || e.key === " ")
                        ) {
                          e.preventDefault();
                          handleSelectOption(opt.id, opt.isCorrect);
                        }
                      }}
                      tabIndex={isAnswered ? -1 : 0}
                      role="button"
                      aria-disabled={isAnswered}
                      className={cn(
                        "border border-border bg-muted/50 transition-all duration-200 select-none group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        cardState,
                      )}
                    >
                      <CardContent className="flex items-start gap-3">
                        {/* Interactive Radio Circle Affordance Indicator */}
                        <div
                          className={cn(
                            "size-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200",
                            isAnswered && opt.isCorrect
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : isAnswered && isSelected && !opt.isCorrect
                                ? "border-rose-500 bg-rose-500 text-white"
                                : "border-border bg-muted/60 group-hover:border-primary group-hover:bg-primary/10",
                          )}
                        >
                          {isAnswered && opt.isCorrect ? (
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          ) : isAnswered && isSelected && !opt.isCorrect ? (
                            <XCircle className="h-3 w-3 text-white" />
                          ) : (
                            <div className="size-1 rounded-full bg-transparent group-hover:bg-primary transition-colors" />
                          )}
                        </div>

                        <span className="flex-1 text-xs font-medium leading-relaxed text-foreground">
                          {t(`${optionKey}.text`)}
                        </span>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar (Option 1 - Duolingo/Brilliant style) */}
      {!isCompleted && (
        <div
          className={cn(
            "border-t p-3.5 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition-colors duration-200 shrink-0",
            isAnswered && selectedOpt
              ? selectedOpt.isCorrect
                ? cn(BADGE.positive.border, BADGE.positive.bg)
                : cn(BADGE.negative.border, BADGE.negative.bg)
              : "border-border bg-muted/40",
          )}
        >
          {isAnswered && selectedOpt ? (
            <div className="space-y-1.5 flex-1 min-w-0 animate-in fade-in-50 duration-200">
              <div
                className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  selectedOpt.isCorrect
                    ? PALETTE.positive.text
                    : PALETTE.negative.text,
                )}
              >
                {selectedOpt.isCorrect
                  ? t("learn.quiz_ui.correct")
                  : t("learn.quiz_ui.incorrect")}
              </div>

              <p className="text-xs text-foreground/90 leading-relaxed font-normal">
                {t(
                  `${questionKey}.options.${selectedOpt.id}.explanation`,
                )}
              </p>

              <div className="pt-1.5 border-t border-border/40 space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground block">
                  {t("learn.quiz_ui.takeaway")}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t(`${questionKey}.pro_tip`)}
                </p>
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex items-center text-xs text-muted-foreground font-medium">
              <span>{t("learn.quiz_ui.instruction")}</span>
            </div>
          )}

          {/* Navigation / Next Action Button */}
          <Button
            size="lg"
            disabled={!isAnswered}
            onClick={handleNext}
            className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight shrink-0"
          >
            {currentIndex + 1 === totalQuestions ? (
              <Trophy className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span>
              {currentIndex + 1 === totalQuestions
                ? t("learn.quiz_ui.view_results")
                : t("learn.quiz_ui.next")}
            </span>
          </Button>
        </div>
      )}
    </>
  );
};

export const InteractiveQuiz: React.FC = () => {
  const { t } = useTranslation();

  const syllabusItems = [
    {
      category: "candlestick",
      difficulty: "beginner" as const,
      badge: BADGE.positive,
      icon: TrendingUp,
    },
    {
      category: "chart_pattern",
      difficulty: "intermediate" as const,
      badge: BADGE.warning,
      icon: LayoutGrid,
    },
    {
      category: "indicator",
      difficulty: "intermediate" as const,
      badge: BADGE.warning,
      icon: Activity,
    },
    {
      category: "risk",
      difficulty: "beginner" as const,
      badge: BADGE.positive,
      icon: ShieldCheck,
    },
    {
      category: "smc",
      difficulty: "advanced" as const,
      badge: BADGE.negative,
      icon: Award,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
        {t("learn.quiz_ui.title")}
      </h2>

      {/* Main Single Card: Match Card style in candlestick pattern dialog */}
      <Card className="border border-border">
        <CardContent className="px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            {/* Left Section (7 cols): Mission, Specs & Launch */}
            <div className="lg:col-span-7 flex flex-col justify-start space-y-6">
              <div className="space-y-5">
                {/* Top Specs Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-bold uppercase tracking-wider text-[10px] rounded-md",
                      BADGE.neutral.bg,
                      BADGE.neutral.text,
                      BADGE.neutral.border,
                    )}
                  >
                    {t("learn.quiz_ui.badge_questions")}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-bold uppercase tracking-wider text-[10px] rounded-md",
                      BADGE.warning.bg,
                      BADGE.warning.text,
                      BADGE.warning.border,
                    )}
                  >
                    {t("learn.quiz_ui.rules_timer")}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-bold uppercase tracking-wider text-[10px] rounded-md",
                      BADGE.positive.bg,
                      BADGE.positive.text,
                      BADGE.positive.border,
                    )}
                  >
                    {t("learn.quiz_ui.target_badge")}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-foreground leading-tight">
                    {t("learn.quiz_ui.start_title")}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {t("learn.quiz_ui.start_subtitle")}
                  </p>
                </div>

                {/* Big Launch Button (close to subtitle) */}
                <div className="space-y-2.5 pt-1">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="lg"
                        className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>{t("learn.quiz_ui.start_cta")}</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)] sm:max-w-312 max-h-[85vh] border border-border text-foreground flex flex-col gap-0 p-0 overflow-hidden">
                      <QuizSessionContent />
                    </DialogContent>
                  </Dialog>
                  <p className="text-[11px] text-muted-foreground">
                    {t("learn.quiz_ui.start_hint")}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Section (5 cols): Enclosed Syllabus Dossier */}
            <Card className="lg:col-span-5 border border-border">
              <CardContent className="space-y-4">
                <div className="pb-1 border-b border-border/60">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {t("learn.quiz_ui.syllabus_title")}
                  </span>
                </div>

                {/* 5 Topic rows (with icons) */}
                <div className="space-y-2">
                  {syllabusItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.category}
                        className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between gap-3 shadow-2xs hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1 rounded-md bg-primary/10 text-primary shrink-0">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-semibold text-foreground truncate">
                            {t(`learn.quiz_ui.categories.${item.category}`)}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-bold uppercase tracking-wider text-[10px] rounded-md shrink-0",
                            item.badge.bg,
                            item.badge.text,
                            item.badge.border,
                          )}
                        >
                          {t(`learn.common.difficulty.${item.difficulty}`)}
                        </Badge>
                      </div>
                    );
                  })}
                </div>

                {/* Benchmark Callout (without icon) */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-foreground">
                    {t("learn.quiz_ui.passing_standard_title")}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-bold uppercase tracking-wider text-[10px] rounded-md",
                        BADGE.positive.bg,
                        BADGE.positive.text,
                        BADGE.positive.border,
                      )}
                    >
                      {t("learn.quiz_ui.grade_letter", { grade: "B" })}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-bold uppercase tracking-wider text-[10px] rounded-md",
                        BADGE.positive.bg,
                        BADGE.positive.text,
                        BADGE.positive.border,
                      )}
                    >
                      60%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
