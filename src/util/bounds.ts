export function clampLines(start: number, end: number, maxLines: number): [number, number] {
  const s = Math.max(1, start);
  const e = Math.min(s + maxLines - 1, end);
  return [s, e];
}

export function paginate<T>(items: T[], limit: number, offset: number): { items: T[]; truncated: boolean; total: number } {
  const total = items.length;
  const sliced = items.slice(offset, offset + limit);
  return {
    items: sliced,
    truncated: offset + limit < total,
    total,
  };
}
