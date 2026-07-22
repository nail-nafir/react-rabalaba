export const TESTIMONIAL_SECTION_ID = "testimonials";

/** Canonical landing-section link used by the account menu and auth return. */
export const TESTIMONIAL_PATH = `/#${TESTIMONIAL_SECTION_ID}`;

/** Anonymous contributors return to the testimonial section after signing in. */
export const TESTIMONIAL_LOGIN_PATH = `/login?redirect=${encodeURIComponent(TESTIMONIAL_PATH)}`;
