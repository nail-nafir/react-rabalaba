import { useTranslation } from "react-i18next";
import {
  Check,
  Zap,
  Shield,
  Globe,
  ArrowRight,
  Target,
  Wallet,
  ScanBarcode,
  KeyRound,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
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

export default function PricingPage() {
  const { t } = useTranslation();
  const openLicenseDialog = useUIStore((state) => state.openLicenseDialog);
  const { isConfigured } = usePremiumAccess();

  return (
    <div className="w-full py-10 md:py-16">
      <div className="max-w-7xl mx-auto px-6 space-y-6 md:space-y-12 text-center">
        {/* Header */}
        <div className="space-y-4 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground bg-clip-text bg-linear-to-b from-foreground to-foreground/70">
            {t("pricing.title")}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t("pricing.subtitle")}
          </p>
        </div>

        {/* Pricing Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 pt-4 md:pt-12 gap-6 md:gap-12 w-full">
          {/* Basic Plan */}
          <PricingCard
            name={t("pricing.plans.basic.name")}
            price={t("pricing.plans.basic.price")}
            description={t("pricing.plans.basic.description")}
            features={
              t("pricing.plans.basic.features", {
                returnObjects: true,
              }) as string[]
            }
            ctaText={t("pricing.get_started_free")}
            ctaLink="/terminal"
            icon={Globe}
          />

          {/* Pro Plan */}
          <PricingCard
            name={t("pricing.plans.professional.name")}
            price={t("pricing.plans.professional.price")}
            description={t("pricing.plans.professional.description")}
            features={
              t("pricing.plans.professional.features", {
                returnObjects: true,
              }) as string[]
            }
            ctaText={t("pricing.get_started")}
            ctaLink="https://t.me/nailnafir"
            isExternal
            icon={Zap}
            highlighted
          />

          {/* Ultimate Plan */}
          <PricingCard
            name={t("pricing.plans.ultimate.name")}
            price={t("pricing.plans.ultimate.price")}
            description={t("pricing.plans.ultimate.description")}
            features={
              t("pricing.plans.ultimate.features", {
                returnObjects: true,
              }) as string[]
            }
            ctaText={t("pricing.contact_sales")}
            ctaLink="https://t.me/nailnafir"
            isExternal
            icon={Shield}
          />
        </div>

        {/* Payment Methods Section */}
        <div className="max-w-4xl mx-auto space-y-5 md:space-y-8 pt-3 md:pt-8">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight">
              {t("payment.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("payment.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <PaymentCard
              name={t("payment.methods.bank_transfer.name")}
              desc="BCA, Mandiri, BNI, BRI"
              icon={Globe}
            />
            <PaymentCard
              name="E-Wallet"
              desc="GoPay, OVO, Dana, LinkAja"
              icon={Wallet}
            />
            <PaymentCard
              name="QRIS"
              desc={t("payment.methods.qris.desc")}
              icon={ScanBarcode}
            />
            <PaymentCard
              name={t("payment.methods.usdt.name")}
              desc={t("payment.methods.usdt.desc")}
              icon={Zap}
            />
          </div>

          <Card className="flex flex-col items-center justify-center gap-2 border border-border w-full mx-auto overflow-visible px-4 sm:px-6">
            <div className="h-10 w-10 rounded-md bg-foreground/10 text-foreground flex items-center justify-center">
              <Target className="h-5 w-5" />
            </div>
            <CardTitle className="text-sm font-semibold text-center">
              {t("payment.activation_notice_title")}
            </CardTitle>
            <CardDescription className="text-xs text-center">
              {t("payment.activation_notice_desc")}
            </CardDescription>
            {isConfigured && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openLicenseDialog()}
                className="mt-2 text-xs font-bold cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {t("license.activate_btn")}
              </Button>
            )}
          </Card>
        </div>
      </div>
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
    <Card className="hover:border-primary hover:shadow-xl hover:shadow-primary/5 overflow-visible border border-border">
      <CardHeader className="flex flex-col items-center">
        <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <CardTitle className="text-sm font-bold tracking-tight">
          {name}
        </CardTitle>
        <CardDescription className="text-[11px] text-muted-foreground leading-relaxed text-center">
          {desc}
        </CardDescription>
      </CardContent>
    </Card>
  );
}

interface PricingCardProps {
  name: string;
  price: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaLink: string;
  isExternal?: boolean;
  icon: React.ElementType;
  highlighted?: boolean;
}

function PricingCard({
  name,
  price,
  description,
  features,
  ctaText,
  ctaLink,
  isExternal,
  icon: Icon,
  highlighted,
}: PricingCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      className={cn(
        "relative transition-all h-full overflow-visible",
        highlighted
          ? "border border-primary shadow-xl shadow-primary/20 md:scale-110 z-20 md:hover:scale-115 hover:shadow-primary/30"
          : "border border-border hover:border-primary hover:shadow-xl hover:shadow-primary/10 shadow-sm hover:-translate-y-1",
      )}
    >
      {highlighted && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest rounded-md z-30">
          {t("pricing.most_popular")}
        </Badge>
      )}

      <CardHeader className="space-y-4 flex flex-col items-center w-full pt-8 pb-4">
        <div
          className={cn(
            "h-12 w-12 rounded-md flex items-center justify-center mb-2",
            highlighted
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-muted text-foreground",
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl font-bold">{name}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground leading-relaxed min-h-11 line-clamp-2 text-center">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 w-full flex flex-col items-center">
        <div className="flex items-baseline justify-center gap-1 pb-6 w-full">
          <span className="text-4xl font-extrabold tracking-tight">
            {price}
          </span>
          {price !== "Custom" && price !== "Kustom" && (
            <span className="text-muted-foreground text-sm font-medium">
              /{t("pricing.monthly")}
            </span>
          )}
        </div>

        <Separator className="w-full" />

        <ul className="space-y-3 py-6 w-full">
          {features.map((feature, i) => (
            <li
              key={i}
              className="flex items-start justify-center gap-3 text-sm"
            >
              <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-foreground/80 leading-snug text-center">
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="py-6">
        <Link
          to={ctaLink}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className={cn(
            buttonVariants({
              size: "lg",
              variant: highlighted ? "default" : "secondary",
            }),
            "w-full text-sm font-bold tracking-tight whitespace-nowrap py-5",
            highlighted && "shadow-lg shadow-primary/20",
          )}
        >
          <div className="flex items-center justify-center gap-2 w-full">
            {ctaText}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      </CardFooter>
    </Card>
  );
}
