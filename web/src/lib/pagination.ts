export type PageItem = number | 'gap';

/** Page numbers to show: always first and last, a window around the current page, gaps between. */
export function pageWindow(current: number, total: number, siblings = 1): PageItem[] {
  if (total <= 1) return total === 1 ? [1] : [];
  const wanted = new Set<number>([1, total]);
  for (let page = current - siblings; page <= current + siblings; page += 1) {
    if (page >= 1 && page <= total) wanted.add(page);
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const items: PageItem[] = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && page - previous === 2) items.push(previous + 1);
    else if (previous !== undefined && page - previous > 2) items.push('gap');
    items.push(page);
  });
  return items;
}
