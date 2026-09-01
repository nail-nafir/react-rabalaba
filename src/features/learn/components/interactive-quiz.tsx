import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Sparkles,
  Lightbulb,
  ShieldCheck,
  Target,
  BarChart3,
  Timer,
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

export const InteractiveQuiz: React.FC = () => {
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

  // Live Countdown Timer Effect
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

  // Completion Scorecard Screen
  if (isCompleted) {
    return (
      <div className="space-y-6">
        {/* Section Header */}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          {t("learn.quiz_ui.title")}
        </h2>

        <div className="space-y-6 w-full">
          {/* Hero Competency Scorecard Banner */}
          <Card className="border border-border bg-card shadow-sm overflow-hidden">
            <CardContent className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="size-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-sm mt-0.5">
                  <Trophy className="h-8 w-8" />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-md text-[10px] font-bold uppercase tracking-wider",
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
                        "rounded-md text-[10px] font-bold uppercase tracking-wider",
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
                        "rounded-md text-[10px] font-bold uppercase tracking-wider",
                        gradeBadge.bg,
                        gradeBadge.text,
                        gradeBadge.border,
                      )}
                    >
                      {t(`learn.quiz_ui.ranks.${rankKey}`)}
                    </Badge>
                  </div>

                  <h4 className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-foreground">
                    {t("learn.quiz_ui.scorecard")}
                  </h4>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
                    {t("learn.quiz_ui.completed_description")}
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center md:flex-col justify-end gap-3 pt-2 md:pt-0">
                <Button
                  variant="default"
                  size="lg"
                  className="w-full md:w-auto font-bold gap-2 text-xs uppercase tracking-wider cursor-pointer shadow-sm"
                  onClick={handleRestart}
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>{t("learn.quiz_ui.retake_random")}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 4 Metric Performance Dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  {t("learn.quiz_ui.accuracy")}
                </span>
                <Target className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {scorePercentage}%
                </div>
                <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  {t("learn.quiz_ui.correct_scenarios_count", {
                    score,
                    total: totalQuestions,
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  {t("learn.quiz_ui.total_score")}
                </span>
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-primary">
                  {score} / {totalQuestions}
                </div>
                <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  {t("learn.quiz_ui.accumulated_points")}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  {t("learn.quiz_ui.execution_speed")}
                </span>
                <Timer className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {avgSeconds} {t("learn.quiz_ui.seconds_unit")}
                </div>
                <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  {t("learn.quiz_ui.speed_desc", { time: avgSeconds })}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  {t("learn.quiz_ui.status")}
                </span>
                <ShieldCheck className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div>
                <div
                  className={cn(
                    "text-base sm:text-lg font-bold uppercase tracking-tight",
                    scorePercentage >= 60
                      ? PALETTE.positive.text
                      : PALETTE.negative.text,
                  )}
                >
                  {scorePercentage >= 60
                    ? t("learn.quiz_ui.passed")
                    : t("learn.quiz_ui.needs_study")}
                </div>
                <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  {t("learn.quiz_ui.competency_standard")}
                </div>
              </div>
            </div>
          </div>

          {/* Scenario Audit & Answer Breakdown Section */}
          <div className="space-y-3 pt-2">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">
                {t("learn.quiz_ui.review_title")}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("learn.quiz_ui.review_desc")}
              </p>
            </div>

            <div className="space-y-3">
              {answers.map((ans, idx) => {
                const qKey = `learn.quiz.questions.${ans.question.id}`;
                const optKey = ans.selectedOptionId
                  ? `${qKey}.options.${ans.selectedOptionId}`
                  : "";

                return (
                  <Card
                    key={`${ans.question.id}-${idx}`}
                    className="border border-border bg-card shadow-xs overflow-hidden"
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Scenario meta + Status badge */}
                      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-md text-[10px] font-bold uppercase tracking-wider",
                              BADGE.neutral.bg,
                              BADGE.neutral.text,
                              BADGE.neutral.border,
                            )}
                          >
                            {t("learn.quiz_ui.scenario_number", {
                              number: idx + 1,
                            })}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-md text-[10px] font-bold uppercase tracking-wider",
                              BADGE.positive.bg,
                              BADGE.positive.text,
                              BADGE.positive.border,
                            )}
                          >
                            {t(
                              `learn.quiz_ui.categories.${ans.question.category}`,
                            )}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-md text-[10px] font-bold uppercase tracking-wider",
                              BADGE.neutral.bg,
                              BADGE.neutral.text,
                              BADGE.neutral.border,
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
                            "rounded-md text-[10px] font-bold uppercase tracking-wider",
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
                          {ans.isCorrect ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {t("learn.quiz_ui.correct_action")}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              {t("learn.quiz_ui.incorrect_action")}
                            </span>
                          )}
                        </Badge>
                      </div>

                      {/* Question Title & Prompt */}
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-foreground">
                          {t(`${qKey}.title`)}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {t(`${qKey}.question`)}
                        </p>
                      </div>

                      {/* User's Choice & Explanation Box */}
                      <div
                        className={cn(
                          "p-3 rounded-lg text-xs leading-relaxed border space-y-1",
                          ans.isCorrect
                            ? cn(BADGE.positive.bg, BADGE.positive.border)
                            : cn(BADGE.negative.bg, BADGE.negative.border),
                        )}
                      >
                        <div className="font-semibold text-foreground">
                          {t("learn.quiz_ui.your_choice")}
                          {optKey
                            ? t(`${optKey}.text`)
                            : t("learn.quiz_ui.incorrect_action")}
                        </div>
                        {optKey && (
                          <p className="text-muted-foreground font-normal">
                            {t(`${optKey}.explanation`)}
                          </p>
                        )}
                      </div>

                      {/* Key Pro Tip Takeaway */}
                      <div className="flex items-start gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40">
                        <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-foreground mr-1">
                            {t("learn.quiz_ui.takeaway")}
                          </strong>
                          {t(`${qKey}.pro_tip`)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedOpt = currentQ.options.find((o) => o.id === selectedOptionId);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
        {t("learn.quiz_ui.title")}
      </h2>

      {/* Main 2-Column Quiz Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
        {/* Left Column: Visual Chart Arena & Scenario (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border border-border bg-card overflow-hidden shadow-sm">
            <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between gap-2 border-b border-border space-y-0">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase font-bold tracking-wider rounded-md",
                    BADGE.positive.bg,
                    BADGE.positive.text,
                    BADGE.positive.border,
                  )}
                >
                  {t(`learn.quiz_ui.categories.${currentQ.category}`)}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase font-bold tracking-wider rounded-md",
                    BADGE.neutral.bg,
                    BADGE.neutral.text,
                    BADGE.neutral.border,
                  )}
                >
                  {t(`learn.common.difficulty.${currentQ.difficulty}`)}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200",
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
                          ),
                  )}
                >
                  <Timer className="h-3 w-3 mr-1 shrink-0" />
                  <span>
                    {t("learn.quiz_ui.seconds_value", { count: timeLeft })}
                  </span>
                </Badge>

                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md text-[10px] font-bold uppercase tracking-wider",
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
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Technical Chart Arena with Dashed Guidelines */}
              <div className="relative p-4 rounded-xl border border-border bg-muted/20 flex flex-col items-center justify-center overflow-hidden">
                {/* Standard dashed technical grid lines */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none opacity-40 flex flex-col justify-around px-4 py-8"
                >
                  <div className="border-b border-dashed border-muted-foreground/30 w-full" />
                  <div className="border-b border-dashed border-muted-foreground/30 w-full" />
                  <div className="border-b border-dashed border-muted-foreground/30 w-full" />
                </div>

                <div className="relative z-10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  {t("learn.quiz_ui.chart_setup")}
                </div>
                <PatternVisual
                  type={currentQ.svgType}
                  className="relative z-10 w-full max-w-lg h-52 sm:h-56"
                />
              </div>

              {/* Scenario Narrative Box */}
              <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                <CardTitle className="text-base font-bold tracking-tight text-foreground">
                  {t(`${questionKey}.title`)}
                </CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {t(`${questionKey}.question`)}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic pt-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{t("learn.quiz_ui.instruction")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Execution Terminal & Decision Buttons (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Progress & Live Score Tracker */}
          <Card className="border border-border bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <span className="text-muted-foreground">
                {t("learn.quiz_ui.current_score", { score })}
              </span>
              <span className="text-primary font-bold">
                {t("learn.quiz_ui.percent_completed", {
                  percent: Math.round(
                    ((currentIndex + (isAnswered ? 1 : 0)) / totalQuestions) *
                      100,
                  ),
                })}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${((currentIndex + 1) / totalQuestions) * 100}%`,
                }}
              />
            </div>
          </Card>

          {/* Multiple Choice Options List */}
          <div className="space-y-2.5">
            {currentQ.options.map((opt) => {
              const optionKey = `${questionKey}.options.${opt.id}`;
              const isSelected = selectedOptionId === opt.id;
              let optStyle =
                "border-border bg-card hover:border-primary/60 hover:bg-muted/20";

              if (isAnswered) {
                if (opt.isCorrect) {
                  optStyle = cn(
                    BADGE.positive.border,
                    BADGE.positive.bg,
                    "text-foreground ring-1 ring-emerald-500/50",
                  );
                } else if (isSelected && !opt.isCorrect) {
                  optStyle = cn(
                    BADGE.negative.border,
                    BADGE.negative.bg,
                    "text-foreground ring-1 ring-rose-500/50",
                  );
                } else {
                  optStyle = "border-border/40 opacity-40 bg-card";
                }
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => handleSelectOption(opt.id, opt.isCorrect)}
                  className={cn(
                    "group w-full p-3.5 sm:p-4 rounded-xl border text-left text-xs font-medium transition-all duration-200 flex items-start gap-3.5 cursor-pointer disabled:cursor-default shadow-xs select-none",
                    optStyle,
                  )}
                >
                  {/* Interactive Radio Circle Affordance Indicator */}
                  <div
                    className={cn(
                      "size-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200",
                      isAnswered && opt.isCorrect
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isAnswered && isSelected && !opt.isCorrect
                          ? "border-rose-500 bg-rose-500 text-white"
                          : "border-border bg-muted/40 group-hover:border-primary group-hover:bg-primary/10",
                    )}
                  >
                    {isAnswered && opt.isCorrect ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    ) : isAnswered && isSelected && !opt.isCorrect ? (
                      <XCircle className="h-3.5 w-3.5 text-white" />
                    ) : (
                      <div className="size-1.5 rounded-full bg-transparent group-hover:bg-primary transition-colors" />
                    )}
                  </div>

                  <span className="flex-1 leading-relaxed pt-0.5">
                    {t(`${optionKey}.text`)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Feedback & Takeaway Card (Appears after answer) */}
          {isAnswered && selectedOpt && (
            <div
              className={cn(
                "p-4 rounded-xl border space-y-3 text-xs leading-relaxed animate-in fade-in-50 slide-in-from-top-2 duration-300",
                selectedOpt.isCorrect
                  ? cn(BADGE.positive.border, BADGE.positive.bg)
                  : cn(BADGE.negative.border, BADGE.negative.bg),
              )}
            >
              <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
                {selectedOpt.isCorrect ? (
                  <>
                    <CheckCircle2
                      className={cn("h-4 w-4", PALETTE.positive.text)}
                    />
                    <span className={PALETTE.positive.text}>
                      {t("learn.quiz_ui.correct")}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className={cn("h-4 w-4", PALETTE.negative.text)} />
                    <span className={PALETTE.negative.text}>
                      {t("learn.quiz_ui.incorrect")}
                    </span>
                  </>
                )}
              </div>

              <p className="text-foreground leading-relaxed font-normal">
                {t(`${questionKey}.options.${selectedOpt.id}.explanation`)}
              </p>

              <div className="pt-2 flex items-start gap-2 text-[11px] text-muted-foreground border-t border-border/40">
                <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground mr-1">
                    {t("learn.quiz_ui.takeaway")}
                  </strong>
                  {t(`${questionKey}.pro_tip`)}
                </span>
              </div>
            </div>
          )}

          {/* Navigation / Next Action Button */}
          <Button
            size="lg"
            disabled={!isAnswered}
            onClick={handleNext}
            className="w-full font-bold transition-all text-xs cursor-pointer items-center justify-center gap-1.5 tracking-tight"
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
      </div>
    </div>
  );
};
