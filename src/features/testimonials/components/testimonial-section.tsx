import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageSquareQuote, RefreshCw, Star } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  TESTIMONIAL_LOGIN_PATH,
  TESTIMONIAL_QUERY_PARAM,
  TESTIMONIAL_QUERY_VALUE,
  TESTIMONIAL_SECTION_ID,
} from "@/features/testimonials/constants";
import { TestimonialDialog } from "@/features/testimonials/components/testimonial-dialog";
import { useFeaturedTestimonials } from "@/features/testimonials/hooks/use-testimonials";

function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return letters || "RL";
}

export function TestimonialSection() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { testimonials, isLoading, isError, refetch } =
    useFeaturedTestimonials();
  const isDialogRequested =
    searchParams.get(TESTIMONIAL_QUERY_PARAM) === TESTIMONIAL_QUERY_VALUE;

  useEffect(() => {
    if (!isDialogRequested) return;
    const section = document.getElementById(TESTIMONIAL_SECTION_ID);
    if (!section) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    section.scrollIntoView({
      block: "start",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [isDialogRequested]);

  const setDialogOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set(TESTIMONIAL_QUERY_PARAM, TESTIMONIAL_QUERY_VALUE);
    else next.delete(TESTIMONIAL_QUERY_PARAM);

    const query = next.toString();
    navigate(
      {
        pathname: "/",
        search: query ? `?${query}` : "",
        hash: `#${TESTIMONIAL_SECTION_ID}`,
      },
      { replace: !open },
    );
  };

  const contributionButton = isAuthenticated ? (
    <Button onClick={() => setDialogOpen(true)}>
      <MessageSquareQuote data-icon="inline-start" />
      {t("testimonials.cta", "Bagikan pengalaman")}
    </Button>
  ) : (
    <Link to={TESTIMONIAL_LOGIN_PATH} className={buttonVariants()}>
      <MessageSquareQuote data-icon="inline-start" />
      {t("testimonials.cta", "Bagikan pengalaman")}
    </Link>
  );

  return (
    <section
      id={TESTIMONIAL_SECTION_ID}
      className="relative z-10 scroll-mt-8 py-24"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <MessageSquareQuote className="size-7 text-primary" aria-hidden />
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {t("testimonials.title", "Cerita dari Pengguna")}
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            {t(
              "testimonials.subtitle",
              "Pengalaman nyata pengguna RabaLaba saat meriset pasar dan susun keputusan transaksi biar makin gacor dan anti rungkad.",
            )}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="h-full">
                <CardHeader className="grid grid-cols-[auto_1fr] gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-4 w-28" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <Card className="mx-auto w-full max-w-2xl">
            <CardHeader className="items-center text-center">
              <CardTitle>
                {t(
                  "testimonials.load_error_title",
                  "Ulasan belum bisa dimuat",
                )}
              </CardTitle>
              <CardDescription>
                {t(
                  "testimonials.load_error_description",
                  "Coba muat ulang atau bagikan pengalaman sementara ini.",
                )}
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center gap-2">
              <Button variant="outline" onClick={() => void refetch()}>
                <RefreshCw data-icon="inline-start" />
                {t("common.retry", "Coba lagi")}
              </Button>
              {contributionButton}
            </CardFooter>
          </Card>
        ) : testimonials.length === 0 ? (
          <Card className="mx-auto w-full max-w-2xl">
            <CardHeader className="items-center text-center">
              <CardTitle>
                {t(
                  "testimonials.empty_title",
                  "Jadilah cerita pertama",
                )}
              </CardTitle>
              <CardDescription>
                {t(
                  "testimonials.empty_description",
                  "Belum ada ulasan pilihan sejauh ini. Kalau RabaLaba membantu, bagikan pengalaman nyata secara jujur biar makin banyak orang bisa ikut panen cuan.",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              {contributionButton}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((testimonial) => {
                const rating = Math.max(
                  1,
                  Math.min(5, Math.round(testimonial.rating)),
                );

                return (
                  <Card key={testimonial.slot} className="h-full">
                    <CardHeader className="grid grid-cols-[auto_1fr] gap-3">
                      <Avatar size="lg">
                        <AvatarFallback>
                          {initials(testimonial.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <CardTitle className="truncate">
                          {testimonial.display_name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1.5 mt-0.5 min-h-5">
                          {testimonial.verified_purchase ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-[9px] font-bold text-emerald-500 border-emerald-500/20 px-1.5 py-0 uppercase">
                              {t("testimonials.membership.member_premium", "anggota premium")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-[9px] font-bold text-muted-foreground border-transparent px-1.5 py-0 uppercase">
                              {t("testimonials.membership.member_free", "anggota gratis")}
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <blockquote className="text-sm leading-relaxed text-foreground">
                        &ldquo;{testimonial.body}&rdquo;
                      </blockquote>
                    </CardContent>
                    <CardFooter>
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
                );
              })}
            </div>
            <div className="flex justify-center">{contributionButton}</div>
          </>
        )}
      </div>

      <TestimonialDialog
        open={isDialogRequested && isAuthenticated}
        onOpenChange={setDialogOpen}
      />
    </section>
  );
}
