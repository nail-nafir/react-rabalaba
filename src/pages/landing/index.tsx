import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import {
  TrendingUp,
  BarChart3,
  Target,
  Activity,
  CalendarDays,
  Gauge,
  Monitor,
  CreditCard,
} from "lucide-react";
import { MarketTicker } from "@/components/layout/market-ticker";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface FAQItem {
  q: string;
  a: string;
}

export default function LandingPage() {
  const { t } = useTranslation();

  const FEATURES = useMemo(
    () => [
      {
        id: "multi_asset",
        icon: BarChart3,
        title: t("features.multi_asset.title"),
        description: t("features.multi_asset.description"),
      },
      {
        id: "sentiment",
        icon: TrendingUp,
        title: t("features.sentiment.title"),
        description: t("features.sentiment.description"),
      },
      {
        id: "trading_plan",
        icon: Target,
        title: t("features.trading_plan.title"),
        description: t("features.trading_plan.description"),
      },
      {
        id: "volume",
        icon: Activity,
        title: t("features.volume.title"),
        description: t("features.volume.description"),
      },
      {
        id: "calendar",
        icon: CalendarDays,
        title: t("features.calendar.title"),
        description: t("features.calendar.description"),
      },
      {
        id: "fear_greed",
        icon: Gauge,
        title: t("features.fear_greed.title"),
        description: t("features.fear_greed.description"),
      },
    ],
    [t],
  );

  const faqQuestions = useMemo<FAQItem[]>(() => {
    const questions = t("faq.questions", { returnObjects: true });
    return Array.isArray(questions) ? (questions as FAQItem[]) : [];
  }, [t]);

  return (
    <div className="relative min-h-screen bg-background selection:bg-primary/20 overflow-x-hidden">
      {/* Background System - Minimalist Grid */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_2px,transparent_2px),linear-gradient(to_bottom,#80808012_2px,transparent_2px)] bg-size-[40px_40px] mask-[radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* ===== HERO SECTION ===== */}
      <section className="relative z-10 flex min-h-[calc(100vh-10rem)] md:min-h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-7xl mx-auto px-6">
          <div className="text-center space-y-8">
            <div className="flex justify-center">
              <Badge className="bg-primary/15 text-primary border-primary/30 text-[11px] font-bold uppercase tracking-wider rounded-full shadow-sm animate-shimmer">
                {t("hero.badge")}
              </Badge>
            </div>

            <div className="max-w-3xl mx-auto space-y-6">
              <h1 className="text-4xl sm:text-7xl font-bold tracking-tight text-foreground leading-[1.1]">
                {t("common.research")}. {t("common.analyze")}.{" "}
                {t("common.execute")}.
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                {t("hero.subtitle")}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link
                to="/terminal"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "rounded-xl h-11 px-8 font-bold",
                )}
              >
                <Monitor className="mr-2 h-4 w-4" />
                {t("common.open_terminal")}
              </Link>
              <Link
                to="/pricing"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "lg" }),
                  "rounded-xl h-11 px-8 font-bold",
                )}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {t("common.view_plans")}
              </Link>
            </div>
          </div>
        </div>

        {/* Integrated Ticker inside Hero - Bottom Aligned */}
        <div className="w-full max-w-7xl mx-auto px-6 pb-12">
          <MarketTicker showTitle />
        </div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section
        id="features"
        className="relative z-10 py-24 scroll-mt-8 bg-muted/40"
      >
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {t("features.subtitle")}{" "}
              <span className="text-primary">{t("features.highlight")}</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
              {t("features.description")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.id}>
                  <Card className="h-full border border-border bg-background hover:border-primary transition-all duration-300 shadow-sm items-center text-center">
                    <CardHeader className="flex flex-col items-center w-full">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary mb-2 group-hover:scale-110 transition-transform">
                        <Icon className="h-6 w-6" />
                      </div>
                      <CardTitle className="font-bold tracking-tight">
                        {feature.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="relative z-10 py-24 bg-muted/40">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {t("faq.title")}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
              {t("faq.subtitle")}
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Card className="border border-border bg-background">
              <CardContent>
                <Accordion collapsible type="single">
                  {faqQuestions.map((item, i) => (
                    <AccordionItem key={i} value={`item-${i}`}>
                      <AccordionTrigger className="hover:text-primary text-base tracking-tight font-bold text-foreground">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
