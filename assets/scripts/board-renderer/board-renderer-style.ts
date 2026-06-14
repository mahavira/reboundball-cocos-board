import type {
  BoardPlacementPreview,
  Direction,
  GridCoord,
} from '../shared/types.ts';
export {
  formatSupportName,
  formatWeaponName,
  getTurnerGlyphPath,
} from '../entity-visual/entity-visual-style.ts';

type Rgba = readonly [number, number, number, number];
type Vec3Components = readonly [number, number, number];

const DIRECTION_OFFSET_BY_DIRECTION: Record<Direction, Vec3Components> = {
  up: [0, 40, 0],
  down: [0, -40, 0],
  left: [-40, 0, 0],
  right: [40, 0, 0],
};

const GRID_FILL_RGBA_BY_ZONE = {
  entry: [34, 197, 94, 210],
  inner: [227, 230, 241, 210],
  pipe: [51, 65, 85, 180],
} as const satisfies Record<'entry' | 'inner' | 'pipe', Rgba>;

const PLACEMENT_HIGHLIGHT_PALETTE_BY_STATE = {
  blocked: {
    fill: [248, 113, 113, 92],
    stroke: [239, 68, 68, 220],
  },
  mergeable: {
    fill: [253, 224, 71, 92],
    stroke: [234, 179, 8, 220],
  },
  placeable: {
    fill: [134, 239, 172, 92],
    stroke: [34, 197, 94, 220],
  },
} as const satisfies Record<
  Extract<BoardPlacementPreview['state'], 'placeable' | 'mergeable' | 'blocked'>,
  { fill: Rgba; stroke: Rgba }
>;

/** 纯样式映射层，只负责把方向语义转换成渲染偏移。 */
export function getDirectionOffsetComponents(direction: Direction): [number, number, number] {
  return [...DIRECTION_OFFSET_BY_DIRECTION[direction]];
}

/** 纯样式映射层，统一返回棋盘格底色，避免在渲染器里散落坐标判断。 */
export function getGridFillRgba(coord: GridCoord): [number, number, number, number] {
  if (coord.row === 3 && coord.col === 0) {
    return [...GRID_FILL_RGBA_BY_ZONE.entry];
  }
  if (coord.row >= 1 && coord.row <= 5 && coord.col >= 1 && coord.col <= 5) {
    return [...GRID_FILL_RGBA_BY_ZONE.inner];
  }
  return [...GRID_FILL_RGBA_BY_ZONE.pipe];
}

/** 放置反馈颜色集中收口，避免 fill/stroke 两套判断在渲染器里漂移。 */
export function getPlacementHighlightPalette(
  state: Extract<BoardPlacementPreview['state'], 'placeable' | 'mergeable' | 'blocked'>,
): { fill: [number, number, number, number]; stroke: [number, number, number, number] } {
  const palette = PLACEMENT_HIGHLIGHT_PALETTE_BY_STATE[state];
  return {
    fill: [...palette.fill],
    stroke: [...palette.stroke],
  };
}
