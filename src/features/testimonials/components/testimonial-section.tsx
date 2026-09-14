import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageSquareQuote, RefreshCw, Star } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/formatters";
import {
  TESTIMONIAL_LOGIN_PATH,
  TESTIMONIAL_SECTION_ID,
} from "@/features/testimonials/constants";
import { UserTestimonialDialog } from "@/features/testimonials/components/user-testimonial-dialog";
import {
  useFeaturedTestimonials,
  useMyTestimonial,
} from "@/features/testimonials/hooks/use-testimonials";
import { usePremiumAccess } from "@/features/auth/hooks/use-premium-access";

export function TestimonialSection() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { isOwner, isAdmin, tier } = usePremiumAccess();
  const { submission: mySubmission } = useMyTestimonial(isAuthenticated);
  const { testimonials, isLoading, isError, refetch } =
    useFeaturedTestimonials();

  const [api, setApi] = useState<CarouselApi>();
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    if (!api) return;
    const updateScrollability = () => {
      const snaps = api.scrollSnapList();
      setCanScroll(snaps.length > 1);
    };

    updateScrollability();
    api.on("select", updateScrollability);
    api.on("reInit", updateScrollability);
    return () => {
      api.off("select", updateScrollability);
      api.off("reInit", updateScrollability);
    };
  }, [api]);

  const contributionButton = isAuthenticated ? (
    <UserTestimonialDialog
      trigger={
        <Button
          size="lg"
          className="rounded-xl h-11 px-8 font-bold cursor-pointer"
        >
          <MessageSquareQuote className="mr-2 h-4 w-4" />
          {t("testimonials.cta")}
        </Button>
      }
    />
  ) : (
    <Link
      to={TESTIMONIAL_LOGIN_PATH}
      className={cn(
        buttonVariants({ size: "lg" }),
        "rounded-xl h-11 px-8 font-bold cursor-pointer",
      )}
    >
      <MessageSquareQuote className="mr-2 h-4 w-4" />
      {t("testimonials.cta")}
    </Link>
  );

  return (
    <section
      id={TESTIMONIAL_SECTION_ID}
      className="relative z-10 scroll-mt-8 py-24"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <Badge className="bg-primary/15 text-primary border-primary/30 text-[11px] font-bold uppercase tracking-wider rounded-full shadow-xs animate-shimmer">
            {t("testimonials.badge")}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {t("testimonials.title")}
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            {t("testimonials.subtitle")}
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-wrap justify-center gap-6 max-w-7xl mx-auto w-full">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card
                key={index}
                className="flex h-full w-full max-w-md min-w-70 flex-1 flex-col justify-between border border-border bg-card/45 backdrop-blur-xs lg:max-w-sm"
                aria-hidden="true"
              >
                <CardHeader className="grid grid-cols-[auto_1fr] gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="min-w-0">
                    <div className="flex min-h-5 items-center gap-1.5">
                      <Skeleton className="h-4 w-32 max-w-full" />
                      <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex min-w-0 flex-col gap-2">
                  <Skeleton className="h-3 w-full max-w-full" />
                  <Skeleton className="h-3 w-full max-w-full" />
                  <Skeleton className="h-3 w-3/4 max-w-full" />
                </CardContent>
                <CardFooter className="mt-auto border-t border-border/40">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, star) => (
                      <Skeleton key={star} className="size-4 rounded-md" />
                    ))}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : isError && testimonials.length === 0 ? (
          <Card className="mx-auto w-full max-w-2xl">
            <Empty role="alert" className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <RefreshCw aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{t("testimonials.load_error_title")}</EmptyTitle>
                <EmptyDescription>
                  {t("testimonials.load_error_description")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => void refetch()}>
                  <RefreshCw data-icon="inline-start" />
                  {t("common.retry")}
                </Button>
                {contributionButton}
              </EmptyContent>
            </Empty>
          </Card>
        ) : testimonials.length === 0 ? (
          <Card className="mx-auto w-full max-w-2xl">
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquareQuote aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{t("testimonials.empty_title")}</EmptyTitle>
                <EmptyDescription>
                  {t("testimonials.empty_description")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>{contributionButton}</EmptyContent>
            </Empty>
          </Card>
        ) : (
          <>
            <Carousel
              setApi={setApi}
              opts={{
                align: "center",
                loop: canScroll,
              }}
              plugins={
                canScroll
                  ? [
                      Autoplay({
                        delay: 3500,
                        stopOnInteraction: false,
                        stopOnMouseEnter: true,
                      }),
                    ]
                  : []
              }
              className="relative mx-auto w-[calc(100%-6rem)] max-w-6xl"
            >
              <CarouselContent className="-ml-4 py-2">
                {testimonials.map((testimonial) => {
                  const rating = Math.max(
                    1,
                    Math.min(5, Math.round(testimonial.rating)),
                  );

                  return (
                    <CarouselItem
                      key={testimonial.slot}
                      className={cn(
                        "pl-4",
                        testimonials.length === 1
                          ? "basis-full max-w-lg mx-auto"
                          : testimonials.length === 2
                            ? "basis-full md:basis-1/2"
                            : "basis-full md:basis-1/2 lg:basis-1/3",
                      )}
                    >
                      <Card className="flex h-full w-full flex-col justify-between border border-border bg-card/45 backdrop-blur-xs">
                        <CardHeader className="grid grid-cols-[auto_1fr] gap-3">
                          <Avatar size="lg">
                            <AvatarFallback>
                              {getInitials(testimonial.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <CardTitle className="truncate">
                              {testimonial.display_name}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-1.5 mt-0.5 min-h-5">
                              {(() => {
                                const isMyCard = Boolean(
                                  (mySubmission &&
                                    testimonial.submission_id ===
                                      mySubmission.id) ||
                                  (user &&
                                    ((user.user_metadata?.full_name &&
                                      user.user_metadata.full_name.trim() ===
                                        testimonial.display_name.trim()) ||
                                      (user.email &&
                                        user.email.split("@")[0].trim() ===
                                          testimonial.display_name.trim()))),
                                );

                                const role = isMyCard
                                  ? isOwner
                                    ? "owner"
                                    : isAdmin
                                      ? "admin"
                                      : "member"
                                  : "member";

                                const isPremium = isMyCard
                                  ? tier === "premium" ||
                                    tier === "trial" ||
                                    testimonial.verified_purchase
                                  : testimonial.verified_purchase;

                                const kasta = isPremium ? "premium" : "free";
                                const badgeKey = `testimonials.membership.${role}_${kasta}`;

                                return (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[9px] font-bold px-1.5 py-0 uppercase",
                                      isPremium
                                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                        : "bg-muted text-muted-foreground border-transparent",
                                    )}
                                  >
                                    {t(badgeKey)}
                                  </Badge>
                                );
                              })()}
                            </CardDescription>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <blockquote className="text-sm leading-relaxed text-foreground">
                            &ldquo;{testimonial.body}&rdquo;
                          </blockquote>
                        </CardContent>
                        <CardFooter className="mt-auto border-t border-border/40">
                          <div
                            role="img"
                            aria-label={t(
                              `testimonials.rating.${rating}`,
                              `${rating} dari 5 bintang`,
                            )}
                            className="flex gap-1"
                          >
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                aria-hidden
                                className={cn(
                                  "size-4",
                                  star <= rating
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/40",
                                )}
                              />
                            ))}
                          </div>
                        </CardFooter>
                      </Card>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>

              {canScroll && (
                <>
                  <CarouselPrevious />
                  <CarouselNext />
                </>
              )}
            </Carousel>

            <div className="flex justify-center">{contributionButton}</div>
          </>
        )}
      </div>
    </section>
  );
}
