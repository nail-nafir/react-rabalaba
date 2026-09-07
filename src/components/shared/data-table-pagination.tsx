import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Table as TanStackTable } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DataTablePaginationProps<TData> = {
  table: TanStackTable<TData>;
  className?: string;
  hideWhenSinglePage?: boolean;
};

export function DataTablePagination<TData>({
  table,
  className,
  hideWhenSinglePage = false,
}: DataTablePaginationProps<TData>) {
  const { t } = useTranslation();
  const pageInputId = useId();
  const pageCount = table.getPageCount();
  const currentPage =
    pageCount > 0 ? table.getState().pagination.pageIndex + 1 : 0;

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  if (hideWhenSinglePage && pageCount <= 1) return null;

  const canJump = pageCount > 1;

  const submitEdit = () => {
    setIsEditing(false);
    const trimmedInput = editValue.trim();
    if (trimmedInput === "") return;

    const parsed = Number(trimmedInput);
    if (!Number.isFinite(parsed)) return;

    const nextPage = Math.min(Math.max(Math.trunc(parsed), 1), pageCount);
    table.setPageIndex(nextPage - 1);
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 text-xs select-none",
        className,
      )}
      aria-live="polite"
    >
      {/* Left Side: Page/Row Information & Interactive Click-to-Edit Input */}
      <div className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap">
        <span>{t("table.page")}</span>
        {isEditing ? (
          <Input
            id={pageInputId}
            type="number"
            inputMode="numeric"
            min={1}
            max={pageCount || 1}
            value={editValue}
            autoFocus
            onFocus={(e) => e.target.select()}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                submitEdit();
              } else if (e.key === "Escape") {
                setIsEditing(false);
              }
            }}
            onBlur={submitEdit}
            className="h-7 w-12 px-1 text-center text-xs rounded border border-border bg-background focus-visible:ring-1 focus-visible:ring-primary shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (canJump) {
                setEditValue(String(currentPage));
                setIsEditing(true);
              }
            }}
            disabled={!canJump}
            className={cn(
              "font-semibold text-foreground px-1.5 py-0.5 rounded border border-border hover:bg-muted/50 transition-all duration-150 inline-flex items-center justify-center min-w-6",
              canJump && "cursor-pointer",
            )}
            title={canJump ? "Click to edit page" : undefined}
          >
            {currentPage}
          </button>
        )}
        <span>{t("table.of")}</span>
        <span className="font-semibold text-foreground">{pageCount || 0}</span>
      </div>

      {/* Right Side: Page Navigation Buttons */}
      <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage()}
          className="hidden sm:inline-flex cursor-pointer"
          aria-label={t("table.first_page")}
          title={t("table.first_page")}
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="cursor-pointer"
          aria-label={t("table.previous_page")}
          title={t("table.previous_page")}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="cursor-pointer"
          aria-label={t("table.next_page")}
          title={t("table.next_page")}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => table.lastPage()}
          disabled={!table.getCanNextPage()}
          className="hidden sm:inline-flex cursor-pointer"
          aria-label={t("table.last_page")}
          title={t("table.last_page")}
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
