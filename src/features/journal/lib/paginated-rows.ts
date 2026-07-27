const DEFAULT_PAGE_SIZE = 1_000;

/**
 * Collect range-paginated rows without inheriting PostgREST's project row cap.
 * Duplicate IDs are ignored so a concurrent writer cannot duplicate a row if
 * offset pages shift slightly while the sequence is being fetched.
 */
export async function collectPaginatedRows<T extends { id: string }>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const byId = new Map<string, T>();

  for (let page = 0; ; page += 1) {
    const from = page * pageSize;
    const rows = await fetchPage(from, from + pageSize - 1);
    for (const row of rows) byId.set(row.id, row);
    if (rows.length < pageSize) break;
  }

  return [...byId.values()];
}
