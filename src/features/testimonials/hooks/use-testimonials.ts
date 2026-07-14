import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/services/supabase/client";
import type {
  FeaturedTestimonialRow,
  TestimonialSubmissionRow,
} from "@/services/supabase/database.types";
import type { TestimonialFormValues } from "@/features/testimonials/schemas/testimonial-schema";

const FEATURED_TESTIMONIALS_KEY = ["featured-testimonials"] as const;
const EMPTY_FEATURED: FeaturedTestimonialRow[] = [];

function myTestimonialKey(userId: string | null) {
  return ["my-testimonial", userId] as const;
}

export function useFeaturedTestimonials() {
  const query = useQuery({
    queryKey: FEATURED_TESTIMONIALS_KEY,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_testimonials")
        .select("*")
        .order("slot", { ascending: true })
        .limit(6);

      if (error) throw error;
      return data as FeaturedTestimonialRow[];
    },
  });

  return {
    testimonials: query.data ?? EMPTY_FEATURED,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useMyTestimonial(enabled = true) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const queryKey = myTestimonialKey(userId);

  const query = useQuery({
    queryKey,
    enabled: !!userId && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testimonial_submissions")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();

      if (error) throw error;
      return data as TestimonialSubmissionRow | null;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (
      values: TestimonialFormValues,
    ): Promise<TestimonialSubmissionRow> => {
      if (!userId) throw new Error("Authentication required");

      const payload = {
        body: values.body,
        rating: values.rating,
      };

      if (query.data) {
        const { data, error } = await supabase
          .from("testimonial_submissions")
          .update(payload as never)
          .eq("id", query.data.id)
          .eq("user_id", userId)
          .select("*")
          .single();

        if (error) throw error;
        return data as TestimonialSubmissionRow;
      }

      const insertResult = await supabase
        .from("testimonial_submissions")
        .insert({ ...payload, user_id: userId } as never)
        .select("*")
        .single();

      if (!insertResult.error) {
        return insertResult.data as TestimonialSubmissionRow;
      }

      // Another tab may have created the user's single row after this query.
      // Resolve that harmless race as an edit instead of surfacing a duplicate.
      if (insertResult.error.code === "23505") {
        const { data, error } = await supabase
          .from("testimonial_submissions")
          .update(payload as never)
          .eq("user_id", userId)
          .select("*")
          .single();

        if (error) throw error;
        return data as TestimonialSubmissionRow;
      }

      throw insertResult.error;
    },
    onSuccess: async (row) => {
      queryClient.setQueryData(queryKey, row);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: FEATURED_TESTIMONIALS_KEY }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !query.data) throw new Error("Testimonial not found");

      const { error } = await supabase
        .from("testimonial_submissions")
        .delete()
        .eq("id", query.data.id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.setQueryData(queryKey, null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: FEATURED_TESTIMONIALS_KEY }),
      ]);
    },
  });

  return {
    submission: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    saveTestimonial: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    deleteTestimonial: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
