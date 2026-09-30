/** Keep the first context readable and reserve the overflow button before fitting extras. */
export function visibleContextCount(width: number, badges: readonly number[], moreWidth: number, gap = 8) {
  if (badges.length < 2) return badges.length;
  if (badges.reduce((sum, size) => sum + size, 0) + gap * (badges.length - 1) <= width) return badges.length;
  let count = 1;
  let used = badges[0] + gap + moreWidth;
  for (const size of badges.slice(1)) {
    if (used + gap + size > width) break;
    used += gap + size;
    count += 1;
  }
  return count;
}
