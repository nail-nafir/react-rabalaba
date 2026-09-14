import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { FieldError } from "@/components/ui/field";

export function FormFieldError({
  errors,
  ...props
}: ComponentProps<typeof FieldError>) {
  const { t, i18n } = useTranslation();

  return (
    <FieldError
      {...props}
      errors={errors?.map((error) =>
        error?.message && i18n.exists(error.message)
          ? { ...error, message: t(error.message) }
          : error,
      )}
    />
  );
}
