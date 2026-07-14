import type { TFunction } from "i18next";
import { z } from "zod";

export const TESTIMONIAL_LIMITS = {
  body: { min: 20, max: 500 },
  rating: { min: 1, max: 5 },
} as const;

export function createTestimonialSchema(t: TFunction) {
  return z.object({
    body: z
      .string()
      .trim()
      .min(
        TESTIMONIAL_LIMITS.body.min,
        t(
          "testimonials.validation.body_min",
          "Testimoni minimal 20 karakter.",
        ),
      )
      .max(
        TESTIMONIAL_LIMITS.body.max,
        t(
          "testimonials.validation.body_max",
          "Testimoni maksimal 500 karakter.",
        ),
      ),
    rating: z
      .number()
      .int()
      .min(
        TESTIMONIAL_LIMITS.rating.min,
        t(
          "testimonials.validation.rating_required",
          "Pilih rating dari 1 sampai 5 bintang.",
        ),
      )
      .max(
        TESTIMONIAL_LIMITS.rating.max,
        t(
          "testimonials.validation.rating_required",
          "Pilih rating dari 1 sampai 5 bintang.",
        ),
      ),
  });
}

export type TestimonialFormValues = z.infer<
  ReturnType<typeof createTestimonialSchema>
>;
