export const TESTIMONIAL_QUERY_PARAM = "testimonial";
export const TESTIMONIAL_QUERY_VALUE = "open";
export const TESTIMONIAL_SECTION_ID = "testimonials";

/** Canonical deep link used by the landing CTA, account menu, and auth return. */
export const TESTIMONIAL_PATH = `/?${TESTIMONIAL_QUERY_PARAM}=${TESTIMONIAL_QUERY_VALUE}#${TESTIMONIAL_SECTION_ID}`;

/** Anonymous contributors return directly to the open form after signing in. */
export const TESTIMONIAL_LOGIN_PATH = `/login?redirect=${encodeURIComponent(TESTIMONIAL_PATH)}`;
