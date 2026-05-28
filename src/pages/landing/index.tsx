import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
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

// Animation variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

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
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="text-center space-y-8"
          >
            <motion.div variants={fadeInUp} className="flex justify-center">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl border border-primary/20 bg-primary/5 text-[11px] font-semibold uppercase tracking-wider text-primary shadow-sm">
                {t("hero.badge")}
              </span>
            </motion.div>

            <div className="max-w-3xl mx-auto space-y-6">
              <motion.h1
                variants={fadeInUp}
                className="text-4xl sm:text-7xl font-bold tracking-tight text-foreground leading-[1.1]"
              >
                {t("common.research")}. {t("common.analyze")}.{" "}
                {t("common.execute")}.
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="text-base sm:text-lg text-muted-foreground leading-relaxed"
              >
                {t("hero.subtitle")}
              </motion.p>
            </div>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-3 justify-center pt-4"
            >
              <Link
                to="/terminal"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "rounded-xl h-11 px-8 font-bold shadow-lg shadow-primary/20 whitespace-nowrap",
                )}
              >
                <Monitor className="mr-2 h-4 w-4" />
                {t("common.open_terminal")}
              </Link>
              <Link
                to="/pricing"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "lg" }),
                  "rounded-xl h-11 px-8 font-bold whitespace-nowrap",
                )}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {t("common.view_plans")}
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Integrated Ticker inside Hero - Bottom Aligned */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="w-full max-w-7xl mx-auto px-6 pb-12"
        >
          <MarketTicker showTitle />
        </motion.div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section
        id="features"
        className="relative z-10 py-24 scroll-mt-8 bg-muted/40"
      >
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ margin: "-100px" }}
            variants={staggerContainer}
            className="text-center space-y-3"
          >
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {t("features.subtitle")}{" "}
              <span className="text-primary">{t("features.highlight")}</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
              {t("features.description")}
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ margin: "-50px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div key={feature.id} variants={fadeInUp}>
                  <Card className="h-full border-border hover:border-primary hover:bg-card/60 transition-all duration-300 shadow-sm flex flex-col items-center text-center">
                    <CardHeader className="flex flex-col items-center w-full">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary mb-2 group-hover:scale-110 transition-transform">
                        <Icon className="h-6 w-6" />
                      </div>
                      <CardTitle className="text-base font-bold tracking-tight">
                        {feature.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="relative z-10 py-24 bg-muted/40">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ margin: "-100px" }}
            variants={staggerContainer}
            className="text-center space-y-3"
          >
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {t("faq.title")}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
              {t("faq.subtitle")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ margin: "-100px" }}
            className="max-w-3xl mx-auto rounded-2xl border border-border/50 bg-card backdrop-blur-sm overflow-hidden shadow-sm"
          >
            <Accordion className="w-full">
              {faqQuestions.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="border-border/50 px-4 last:border-0"
                >
                  <AccordionTrigger className="hover:no-underline py-5 text-base tracking-tight font-bold text-foreground transition-all">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-5 leading-relaxed text-sm">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
