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
import { PaymentDialog } from "./components/payment-dialog";

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const { openLicenseDialog } = useUIActions();
  const { isConfigured } = usePremiumAccess();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

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
              {/* Basic Plan */}
              <SubscriptionCard
                name={t("subscription.plans.basic.name")}
                price={t("subscription.plans.basic.price")}
                description={t("subscription.plans.basic.description")}
                features={
                  t("subscription.plans.basic.features", {
                    returnObjects: true,
                  }) as string[]
                }
                ctaText={t("subscription.get_started_free")}
                ctaLink="/terminal"
                icon={Terminal}
                btnIcon={Play}
              />

              {/* Pro Plan */}
              <SubscriptionCard
                name={t("subscription.plans.professional.name")}
                price={t("subscription.plans.professional.price")}
                description={t("subscription.plans.professional.description")}
                features={
                  t("subscription.plans.professional.features", {
                    returnObjects: true,
                  }) as string[]
                }
                ctaText={t("subscription.get_started")}
                ctaLink="https://t.me/nailnafir"
                isExternal
                icon={Zap}
                highlighted
                onCtaClick={() => setIsPaymentDialogOpen(true)}
                btnIcon={CreditCard}
              />

              {/* Ultimate Plan */}
              <SubscriptionCard
                name={t("subscription.plans.ultimate.name")}
                price={t("subscription.plans.ultimate.price")}
                description={t("subscription.plans.ultimate.description")}
                features={
                  t("subscription.plans.ultimate.features", {
                    returnObjects: true,
                  }) as string[]
                }
                ctaText={t("subscription.contact_sales")}
                ctaLink="https://t.me/nailnafir"
                isExternal
                icon={Shield}
                btnIcon={Send}
              />
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
            <Card className="relative border border-border ring-0 items-center justify-center text-center w-full mx-auto shadow-sm">
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
      <CardContent className="flex items-center gap-4">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-muted text-foreground flex items-center justify-center transition-all duration-300 shadow-sm group-hover:bg-muted/80">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="text-xs font-bold tracking-wide uppercase text-foreground/90 group-hover:text-foreground transition-colors">
            {name}
          </CardTitle>
          <CardDescription className="text-[10px] text-muted-foreground truncate leading-relaxed">
            {desc}
          </CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}

interface SubscriptionCardProps {
  name: string;
  price: string;
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

      <CardContent className="flex-1 w-full flex flex-col items-center space-y-6 pb-6">
        <div className="flex items-baseline justify-center gap-1 w-full">
          <span className="text-3xl sm:text-4xl font-black tracking-tight text-foreground font-mono-data">
            {price}
          </span>
          {price !== "Custom" && price !== "Kustom" && (
            <span className="text-muted-foreground text-xs font-semibold font-sans">
              /{t("subscription.monthly")}
            </span>
          )}
        </div>

        <Separator />

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
