import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";

interface PageLoaderProps {
  /**
   * If true, this component acts as a trigger for Suspense
   * (signals the global bar to stay active) and renders nothing.
   */
  trigger?: boolean;
}

/**
 * Unified PageLoader Component.
 * - Usage 1: In RootLayout for the visual bar -> <PageLoader />
 * - Usage 2: In Router for Suspense fallback -> <PageLoader trigger />
 */
export function PageLoader({ trigger = false }: PageLoaderProps) {
  const location = useLocation();
  const { isPageLoading, setPageLoading } = useUIStore();

  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // TRIGGER MODE: Just signals the store
  useEffect(() => {
    if (!trigger) return;

    // Use timeout to avoid "cascading render" warnings
    const timer = setTimeout(() => {
      setPageLoading(true);
    }, 0);

    return () => {
      clearTimeout(timer);
      setPageLoading(false);
    };
  }, [trigger, setPageLoading]);

  // VISUAL MODE: Handle pulse on URL change
  useEffect(() => {
    if (trigger) return;

    const startProgress = () => {
      setIsVisible(true);
      setProgress(15 + Math.random() * 10);
    };

    const timer = requestAnimationFrame(startProgress);
    return () => cancelAnimationFrame(timer);
  }, [location.pathname, location.search, trigger]);

  // VISUAL MODE: Progress animation logic
  useEffect(() => {
    if (trigger || !isVisible) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (isPageLoading) {
          if (prev >= 92) return 92; // Hold near end while loading
          return prev + Math.random() * 1.2;
        }

        if (prev >= 100) return 100;
        return prev + 12; // Fast finish
      });
    }, 70);

    return () => clearInterval(interval);
  }, [isVisible, isPageLoading, trigger]);

  // VISUAL MODE: Auto-hide and reset
  useEffect(() => {
    if (trigger) return;

    if (progress >= 100 && !isPageLoading) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        const resetTimer = setTimeout(() => setProgress(0), 200);
        return () => clearTimeout(resetTimer);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [progress, isPageLoading, trigger]);

  // Render nothing in trigger mode or if not visible
  if (trigger || (!isVisible && progress === 0)) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-200 w-full pointer-events-none">
      <Progress
        value={progress}
        className="gap-0 border-none rounded-none bg-transparent"
      >
        <ProgressTrack className="h-full bg-transparent border-none rounded-none">
          <ProgressIndicator
            className={cn(
              "bg-primary shadow-[0_0_10px_var(--color-primary)] transition-all duration-300 ease-out",
              progress >= 100 ? "opacity-0" : "opacity-100",
            )}
          />
        </ProgressTrack>
      </Progress>
    </div>
  );
}
