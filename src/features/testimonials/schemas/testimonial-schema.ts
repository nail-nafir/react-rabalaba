import * as z from "zod";

export const TESTIMONIAL_LIMITS = {
  body: { min: 20, max: 500 },
  rating: { min: 1, max: 5 },
} as const;

export const testimonialSchema = z.object({
  body: z
    .string()
    .trim()
    .min(TESTIMONIAL_LIMITS.body.min, "testimonials.validation.body_min")
    .max(TESTIMONIAL_LIMITS.body.max, "testimonials.validation.body_max"),
  rating: z
    .number()
    .int()
    .min(
      TESTIMONIAL_LIMITS.rating.min,
      "testimonials.validation.rating_required",
    )
    .max(
      TESTIMONIAL_LIMITS.rating.max,
      "testimonials.validation.rating_required",
    ),
});

export type TestimonialFormValues = z.infer<typeof testimonialSchema>;
