// PRD §7.3.6 — masonry placement. Positions are computed from stored
// dimensions *before* images load, so there is no layout shift (WORK-08).

export type MasonryItem = { id: string; ratio: number }; // ratio = width / height

/** M1 — card media ratio is clamped between 9:16 and 16:9. */
export const clampRatio = (r: number) => Math.min(16 / 9, Math.max(9 / 16, r || 1));

export type MasonryPosition = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function layoutMasonry(
  items: MasonryItem[],
  columns: number,
  containerWidth: number,
  gap: number,
  captionHeight: number, // constant per breakpoint; 0 for overlay captions
): { positions: MasonryPosition[]; containerHeight: number } {
  const cols = Math.max(1, columns);
  const colWidth = (containerWidth - gap * (cols - 1)) / cols;
  const heights: number[] = new Array(cols).fill(0);

  const positions = items.map((item) => {
    // M6 — order is sacred: each next item goes into the shortest column.
    const col = heights.indexOf(Math.min(...heights));
    const height = colWidth / clampRatio(item.ratio) + captionHeight;
    const pos = {
      id: item.id,
      x: col * (colWidth + gap),
      y: heights[col],
      width: colWidth,
      height,
    };
    heights[col] += height + gap;
    return pos;
  });

  return {
    positions,
    containerHeight: Math.max(0, Math.max(...heights, 0) - gap),
  };
}

/** Numeric ratio for a card, honouring the per-item preset (M2). */
export function cardRatio(preset: string, nativeWidth: number, nativeHeight: number): number {
  switch (preset) {
    case "1:1": return 1;
    case "4:5": return 4 / 5;
    case "3:4": return 3 / 4;
    case "2:3": return 2 / 3;
    case "16:9": return 16 / 9;
    case "9:16": return 9 / 16;
    default: return (nativeWidth || 1) / (nativeHeight || 1);
  }
}

export const GAP_PX: Record<"S" | "M" | "L", { mobile: number; desktop: number }> = {
  S: { mobile: 8, desktop: 12 },
  M: { mobile: 16, desktop: 24 },
  L: { mobile: 24, desktop: 40 },
};
