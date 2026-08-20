import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usePremiumAccess } from "@/features/auth/hooks/use-premium-access";
import { supabase } from "@/services/supabase/client";
import type {
  FeaturedTestimonialRow,
  TestimonialStatus,
  TestimonialSubmissionRow,
} from "@/services/supabase/database.types";

export const ADMIN_TESTIMONIALS_KEY = ["admin-testimonials"] as const;
export const FEATURED_TESTIMONIALS_KEY = ["featured-testimonials"] as const;

const EMPTY_SUBMISSIONS: TestimonialSubmissionRow[] = [];
const EMPTY_FEATURED: FeaturedTestimonialRow[] = [];

type ReviewInput = {
  submissionId: string;
  status: Extract<TestimonialStatus, "approved" | "rejected">;
  rejectionReason?: string;
};

type FeatureInput = {
  submissionId: string;
  slot: number;
};

export function useAdminTestimonials() {
  const { isAdmin } = usePremiumAccess();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ADMIN_TESTIMONIALS_KEY,
    enabled: isAdmin,
    staleTime: 30_000,
    queryFn: async () => {
      const [submissionsResult, featuredResult] = await Promise.all([
        supabase
          .from("testimonial_submissions")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("featured_testimonials")
          .select("*")
          .order("slot", { ascending: true }),
      ]);

      if (submissionsResult.error) throw submissionsResult.error;
      if (featuredResult.error) throw featuredResult.error;

      return {
        submissions: submissionsResult.data as TestimonialSubmissionRow[],
        featured: featuredResult.data as FeaturedTestimonialRow[],
      };
    },
  });

  const invalidateTestimonials = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ADMIN_TESTIMONIALS_KEY }),
      queryClient.invalidateQueries({ queryKey: FEATURED_TESTIMONIALS_KEY }),
      queryClient.invalidateQueries({ queryKey: ["my-testimonial"] }),
    ]);
  }, [queryClient]);

  const { mutateAsync: reviewTestimonial } = useMutation({
    mutationFn: async ({
      submissionId,
      status,
      rejectionReason,
    }: ReviewInput) => {
      const { error } = await supabase
        .from("testimonial_submissions")
        .update({
          status,
          rejection_reason:
            status === "rejected" ? rejectionReason?.trim() || null : null,
        } as never)
        .eq("id", submissionId);

      if (error) throw error;
    },
    onSuccess: invalidateTestimonials,
  });

  const { mutateAsync: setFeaturedTestimonial } = useMutation({
    mutationFn: async ({ submissionId, slot }: FeatureInput) => {
      const { error } = await supabase.rpc(
        "admin_set_featured_testimonial" as never,
        {
          p_submission_id: submissionId,
          p_slot: slot,
        } as never,
      );

      if (error) throw error;
    },
    onSuccess: invalidateTestimonials,
  });

  const { mutateAsync: removeFeaturedTestimonial } = useMutation({
    mutationFn: async (submissionId: string) => {
      const { error } = await supabase.rpc(
        "admin_unfeature_testimonial" as never,
        {
          p_submission_id: submissionId,
          p_slot: null,
        } as never,
      );

      if (error) throw error;
    },
    onSuccess: invalidateTestimonials,
  });

  const { mutateAsync: removeTestimonial } = useMutation({
    mutationFn: async (submissionId: string) => {
      const { error } = await supabase
        .from("testimonial_submissions")
        .delete()
        .eq("id", submissionId);

      if (error) throw error;
    },
    onSuccess: invalidateTestimonials,
  });

  const approve = useCallback(
    (submissionId: string) =>
      reviewTestimonial({ submissionId, status: "approved" }),
    [reviewTestimonial],
  );

  const reject = useCallback(
    (submissionId: string, rejectionReason?: string) =>
      reviewTestimonial({
        submissionId,
        status: "rejected",
        rejectionReason,
      }),
    [reviewTestimonial],
  );

  const feature = useCallback(
    (submissionId: string, slot: number) =>
      setFeaturedTestimonial({ submissionId, slot }),
    [setFeaturedTestimonial],
  );

  const unfeature = useCallback(
    (submissionId: string) => removeFeaturedTestimonial(submissionId),
    [removeFeaturedTestimonial],
  );

  const deleteSubmission = useCallback(
    (submissionId: string) => removeTestimonial(submissionId),
    [removeTestimonial],
  );

  const [maxSlots, setMaxSlotsState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("admin_testimonial_max_slots");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 1 && parsed <= 12) return parsed;
      }
    }
    return 6;
  });

  const updateMaxSlots = useCallback(async (count: number) => {
    const clamped = Math.max(1, Math.min(12, count));
    setMaxSlotsState(clamped);
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_testimonial_max_slots", String(clamped));
    }
  }, []);

  return {
    submissions: query.data?.submissions ?? EMPTY_SUBMISSIONS,
    featured: query.data?.featured ?? EMPTY_FEATURED,
    maxSlots,
    updateMaxSlots,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    approve,
    reject,
    feature,
    unfeature,
    deleteSubmission,
  };
}
