import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Zap,
  Shield,
  Target,
  Wallet,
  KeyRound,
  Send,
  Landmark,
  QrCode,
  Coins,
  Play,
  CreditCard,
  Terminal,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useUIActions } from "@/store/hooks";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscriptionPlans } from "@/hooks/use-subscription-plans";
import { pickLocale } from "@/lib/localized";
import { PaymentDialog } from "./components/payment-dialog";

/** lucide icon names stored on a plan row → component. Falls back to Terminal. */
const ICON_MAP: Record<string, React.ElementType> = { Terminal, Zap, Shield };

/** Each cta_kind maps to a CTA label + icon (labels stay static in i18n). */
function ctaConfig(kind: string): {
  labelKey: string;
  icon: React.ElementType;
} {
  switch (kind) {
    case "payment":
      return { labelKey: "subscription.get_started", icon: CreditCard };
    case "license":
      return { labelKey: "license.activate_btn", icon: KeyRound };
    case "contact":
      return { labelKey: "subscription.contact_sales", icon: Send };
    default:
      return { labelKey: "subscription.get_started_free", icon: Play };
  }
}

export default function SubscriptionPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { openLicenseDialog } = useUIActions();
  const { isConfigured } = usePremiumAccess();
  const { plans, isLoading } = useSubscriptionPlans();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const activePlans = plans.filter((p) => p.active);

  return (
    <div className="w-full py-6 sm:py-10 bg-background relative overflow-hidden">
      {/* Decorative Radial Grid / Glow background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-125 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
              {t("subscription.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("subscription.subtitle")}
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-8">
          {/* Subscription Tiers Section */}
          <section className="space-y-3 pb-6 md:pb-10">
            <div className="grid grid-cols-1 md:grid-cols-3 pt-12 md:pt-16 gap-8 md:gap-10 w-full items-stretch">
              {isLoading && activePlans.length === 0
                ? Array.from({ length: 3 }).map((_, i) => (
                    <PlanSkeleton key={i} highlighted={i === 1} />
                  ))
                : activePlans.map((plan) => {
                    const cfg = ctaConfig(plan.cta_kind);
                    const isExternal =
                      !!plan.cta_link && /^https?:\/\//.test(plan.cta_link);
                    const onCtaClick =
                      plan.cta_kind === "payment"
                        ? () => setIsPaymentDialogOpen(true)
                        : plan.cta_kind === "license"
                          ? () => openLicenseDialog()
                          : undefined;
                    return (
                      <SubscriptionCard
                        key={plan.slug}
                        name={pickLocale(plan.name, lang, "") as string}
                        price={pickLocale(plan.price, lang, "") as string}
                        originalPrice={
                          (pickLocale(plan.original_price, lang) as
                            | string
                            | undefined) || undefined
                        }
                        description={
                          pickLocale(plan.description, lang, "") as string
                        }
                        features={
                          pickLocale(plan.features, lang, []) as string[]
                        }
                        ctaText={t(cfg.labelKey)}
                        ctaLink={plan.cta_link ?? "#"}
                        isExternal={isExternal}
                        icon={ICON_MAP[plan.icon ?? ""] ?? Terminal}
                        highlighted={plan.highlighted}
                        onCtaClick={onCtaClick}
                        btnIcon={cfg.icon}
                      />
                    );
                  })}
            </div>
          </section>

          <Separator />

          {/* Payment Methods & Verification Center Section */}
          <section className="space-y-3">
            <div className="pb-2">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                {t("payment.title")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("payment.subtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <PaymentCard
                name={t("payment.methods.bank_transfer.name")}
                desc="BCA, Mandiri, BNI, BRI"
                icon={Landmark}
              />
              <PaymentCard
                name="E-Wallet"
                desc="GoPay, OVO, Dana, LinkAja"
                icon={Wallet}
              />
              <PaymentCard
                name="QRIS"
                desc={t("payment.methods.qris.desc")}
                icon={QrCode}
              />
              <PaymentCard
                name={t("payment.methods.usdt.name")}
                desc={t("payment.methods.usdt.desc")}
                icon={Coins}
              />
            </div>

            {/* Manual Activation Notice Dashboard Bar */}
            <Card className="relative border border-border ring-0 items-center justify-center text-center w-full mx-auto shadow-sm p-6">
              {/* Visual gradient glow element */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none -z-10" />

              <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
                <Target className="h-5.5 w-5.5" />
              </div>
              <div className="space-y-1.5 max-w-xl mx-auto">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
                  {t("payment.activation_notice_title")}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                  {t("payment.activation_notice_desc")}
                </CardDescription>
              </div>
              <div className="flex flex-row items-center justify-center gap-2 mt-2">
                {isConfigured && (
                  <Button
                    size="lg"
                    onClick={() => openLicenseDialog()}
                    className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>{t("license.activate_btn")}</span>
                  </Button>
                )}
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="cursor-pointer transition-all group"
                >
                  <a
                    href="https://t.me/nailnafir"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold tracking-tight">
                      {t("common.contact_team")}
                    </span>
                  </a>
                </Button>
              </div>
            </Card>
          </section>
        </div>
      </div>
      <PaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
      />
    </div>
  );
}

function PaymentCard({
  name,
  desc,
  icon: Icon,
}: {
  name: string;
  desc: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="group relative overflow-hidden border border-border hover:border-primary hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 cursor-pointer ring-0">
      <CardContent className="flex flex-col items-center justify-center text-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-muted text-foreground flex items-center justify-center transition-all duration-300 shadow-sm group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 border border-transparent">
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <CardTitle className="text-xs font-bold tracking-wide uppercase text-foreground/90 group-hover:text-foreground transition-colors">
            {name}
          </CardTitle>
          <CardDescription className="text-[10px] text-muted-foreground leading-relaxed max-w-45 mx-auto">
            {desc}
          </CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}

/** Loading placeholder shaped like a SubscriptionCard while plans fetch. */
function PlanSkeleton({ highlighted }: { highlighted?: boolean }) {
  return (
    <Card
      className={cn(
        "relative transition-all duration-300 h-full flex flex-col",
        highlighted
          ? "border border-primary shadow-2xl shadow-primary/10 md:scale-110 z-20 overflow-visible ring-0"
          : "border border-border shadow-sm overflow-hidden ring-0",
      )}
    >
      {highlighted && (
        <div className="absolute top-0 right-0 left-0 h-0.5 bg-linear-to-r from-transparent via-primary to-transparent" />
      )}

      {highlighted && (
        <Badge className="absolute -top-6.5 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-widest rounded-full bg-primary text-primary-foreground px-3 py-0.5 animate-shimmer shadow-md shadow-primary/25 border-0 z-30 opacity-50">
          <Skeleton className="h-2.5 w-16 bg-primary-foreground/20" />
        </Badge>
      )}

      <CardHeader className="space-y-4 flex flex-col items-center w-full p-6">
        <div
          className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-md",
            highlighted
              ? "bg-primary text-primary-foreground shadow-primary/20 scale-110"
              : "bg-muted text-foreground",
          )}
        >
          <Skeleton
            className={cn(
              "h-6 w-6 rounded-md",
              highlighted
                ? "bg-primary-foreground/25"
                : "bg-muted-foreground/20",
            )}
          />
        </div>
        <div className="text-center space-y-1.5 w-full flex flex-col items-center">
          <CardTitle className="text-lg font-bold tracking-tight uppercase w-full flex justify-center">
            <Skeleton className="h-5 w-24" />
          </CardTitle>
          <div className="w-full min-h-10 flex flex-col items-center justify-center gap-1.5 px-2">
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 w-full flex flex-col items-center space-y-10 pb-6">
        <Card
          className={cn(
            "w-full transition-all duration-300 select-none border shadow-none bg-muted/50",
            highlighted ? "border-primary/20" : "border-border",
          )}
        >
          <CardContent className="flex flex-col items-center justify-center gap-1 p-4">
            <div className="flex items-center gap-2 mb-0.5 min-h-4.5">
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex items-baseline justify-center gap-1 w-full h-10">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-8" />
            </div>
          </CardContent>
        </Card>

        <ul className="space-y-3.5 w-full flex-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-xs leading-normal"
            >
              <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mt-0.5 opacity-40">
                <Check className="h-2.5 w-2.5 stroke-[3px]" />
              </div>
              <Skeleton className="h-3 flex-1 mt-0.5" />
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Skeleton className="h-9 w-full rounded-md" />
      </CardFooter>
    </Card>
  );
}

function calculateDiscountPercentage(
  originalStr: string,
  promoStr: string,
): number {
  const originalVal = parseFloat(originalStr.replace(/[^\d.]/g, ""));
  const promoVal = parseFloat(promoStr.replace(/[^\d.]/g, ""));

  if (isNaN(originalVal) || isNaN(promoVal) || originalVal === 0) {
    return 0;
  }

  const discount = ((originalVal - promoVal) / originalVal) * 100;
  return Math.round(discount);
}

interface SubscriptionCardProps {
  name: string;
  price: string;
  originalPrice?: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaLink: string;
  isExternal?: boolean;
  icon: React.ElementType;
  highlighted?: boolean;
  onCtaClick?: () => void;
  btnIcon?: React.ElementType;
}

function SubscriptionCard({
  name,
  price,
  originalPrice,
  description,
  features,
  ctaText,
  ctaLink,
  isExternal,
  icon: Icon,
  highlighted,
  onCtaClick,
  btnIcon: BtnIcon,
}: SubscriptionCardProps) {
  const { t } = useTranslation();

  const discountPercent = originalPrice
    ? calculateDiscountPercentage(originalPrice, price)
    : 0;

  return (
    <Card
      className={cn(
        "relative transition-all duration-300 h-full flex flex-col cursor-pointer",
        highlighted
          ? "border border-primary shadow-2xl shadow-primary/10 md:scale-110 z-20 hover:scale-[1.12] hover:shadow-primary/20 overflow-visible ring-0"
          : "border border-border hover:border-primary shadow-sm hover:-translate-y-1 hover:shadow-md overflow-hidden ring-0",
      )}
    >
      {highlighted && (
        <div className="absolute top-0 right-0 left-0 h-0.5 bg-linear-to-r from-transparent via-primary to-transparent" />
      )}

      {highlighted && (
        <Badge className="absolute -top-6.5 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-widest rounded-full bg-primary text-primary-foreground px-3 py-0.5 animate-shimmer shadow-md shadow-primary/25 border-0 z-30">
          {t("subscription.most_popular")}
        </Badge>
      )}

      <CardHeader className="space-y-4 flex flex-col items-center w-full p-6">
        <div
          className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-md",
            highlighted
              ? "bg-primary text-primary-foreground shadow-primary/20 scale-110"
              : "bg-muted text-foreground hover:bg-muted/80",
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="text-center space-y-1.5 w-full">
          <CardTitle className="text-lg font-bold tracking-tight uppercase">
            {name}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground leading-relaxed min-h-10 line-clamp-2 px-2">
            {description}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex-1 w-full flex flex-col items-center space-y-10 pb-6">
        <Card
          className={cn(
            "w-full transition-all duration-300 select-none border shadow-none bg-muted/50",
            highlighted
              ? "border-primary/20 hover:border-primary/30"
              : "border-border hover:bg-muted/60",
          )}
        >
          <CardContent className="flex flex-col items-center justify-center gap-1 p-4">
            {originalPrice && (
              <div className="flex items-center gap-2 mb-0.5">
                <span className="relative text-xs font-semibold text-rose-500 dark:text-rose-400 font-mono-data px-1.5 select-none">
                  {originalPrice}
                  <span className="absolute inset-x-0 top-1/2 h-[1.5px] bg-rose-500 dark:bg-rose-400 -translate-y-1/2" />
                </span>
                {discountPercent > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold rounded-md border-emerald-500/30 bg-emerald-500/15 text-emerald-400 uppercase select-none tracking-wider py-0.5 px-2"
                  >
                    {t("subscription.discount_format", {
                      percent: discountPercent,
                    })}
                  </Badge>
                )}
              </div>
            )}
            <div className="flex items-baseline justify-center gap-1 w-full">
              <span className="text-3xl sm:text-4xl font-black tracking-tight text-foreground font-mono-data">
                {price}
              </span>
              {price !== "Custom" && price !== "Kustom" && (
                <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider font-sans ml-1">
                  /{t("subscription.monthly")}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <ul className="space-y-3.5 w-full flex-1">
          {features.map((feature, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-xs leading-normal"
            >
              <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mt-0.5">
                <Check className="h-2.5 w-2.5 stroke-[3px]" />
              </div>
              <span className="text-muted-foreground hover:text-foreground transition-colors duration-150">
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        {onCtaClick ? (
          <Button
            size="lg"
            onClick={onCtaClick}
            variant={highlighted ? "default" : "outline"}
            className={cn(
              "w-full text-xs font-bold transition-all cursor-pointer items-center justify-center gap-1.5 tracking-tight",
              highlighted &&
                "shadow-lg shadow-primary/10 hover:shadow-primary/20",
            )}
          >
            {BtnIcon && (
              <BtnIcon className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110" />
            )}
            <span>{ctaText}</span>
          </Button>
        ) : (
          <Link
            to={ctaLink}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className={cn(
              buttonVariants({
                size: "lg",
                variant: highlighted ? "default" : "outline",
              }),
              "w-full text-xs font-bold transition-all cursor-pointer items-center justify-center gap-1.5 tracking-tight",
              highlighted &&
                "shadow-lg shadow-primary/10 hover:shadow-primary/20",
            )}
          >
            {BtnIcon && (
              <BtnIcon className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110" />
            )}
            <span>{ctaText}</span>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
