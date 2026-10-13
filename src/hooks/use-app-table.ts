import {
  createPaginatedRowModel,
  createSortedRowModel,
  createTableHook,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

/** One feature set for every data table: pagination, plus sorting where a column allows it. */
const features = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  // `sortFn: "auto"` only resolves registered sorters; `basic` is built in.
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

export type DataTableFeatures = typeof features;

export const { useAppTable } = createTableHook({
  features,
  // Empty maps pin the component generics; omitted, they widen to an index
  // signature and a typo like `table.getRowModle` would still type-check.
  tableComponents: {},
  cellComponents: {},
  headerComponents: {},
});
