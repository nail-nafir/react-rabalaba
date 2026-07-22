import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";

interface ActionButtonContentProps {
  label: ReactNode;
  pending?: boolean;
}

export function ActionButtonContent({
  label,
  pending = false,
}: ActionButtonContentProps) {
  return (
    <>
      {pending && <Spinner data-icon="inline-start" aria-hidden="true" />}
      <span>{label}</span>
    </>
  );
}
