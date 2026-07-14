import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usePremiumAccess } from "@/hooks/use-premium-access";
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

  const invalidateTestimonials = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ADMIN_TESTIMONIALS_KEY }),
      queryClient.invalidateQueries({ queryKey: FEATURED_TESTIMONIALS_KEY }),
      queryClient.invalidateQueries({ queryKey: ["my-testimonial"] }),
    ]);
  };

  const reviewMutation = useMutation({
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

  const featureMutation = useMutation({
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

  const unfeatureMutation = useMutation({
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

  const deleteMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      const { error } = await supabase
        .from("testimonial_submissions")
        .delete()
        .eq("id", submissionId);

      if (error) throw error;
    },
    onSuccess: invalidateTestimonials,
  });

  return {
    submissions: query.data?.submissions ?? EMPTY_SUBMISSIONS,
    featured: query.data?.featured ?? EMPTY_FEATURED,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    approve: (submissionId: string) =>
      reviewMutation.mutateAsync({ submissionId, status: "approved" }),
    reject: (submissionId: string, rejectionReason?: string) =>
      reviewMutation.mutateAsync({
        submissionId,
        status: "rejected",
        rejectionReason,
      }),
    feature: (submissionId: string, slot: number) =>
      featureMutation.mutateAsync({ submissionId, slot }),
    unfeature: (submissionId: string) =>
      unfeatureMutation.mutateAsync(submissionId),
    deleteSubmission: (submissionId: string) =>
      deleteMutation.mutateAsync(submissionId),
  };
}
