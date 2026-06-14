import type {
  BoardPlacementPreview,
  Direction,
  GridCoord,
  SupportType,
  TurnerVariant,
  WeaponType,
} from '../shared/types.ts';

type Rgba = readonly [number, number, number, number];
type Point2 = readonly [number, number];
type Vec3Components = readonly [number, number, number];

const DIRECTION_OFFSET_BY_DIRECTION: Record<Direction, Vec3Components> = {
  up: [0, 40, 0],
  down: [0, -40, 0],
  left: [-40, 0, 0],
  right: [40, 0, 0],
};

const TURNER_GLYPH_PATH_BY_VARIANT: Record<TurnerVariant, readonly Point2[]> = {
  'right-up': [
    [-20, 10],
    [-20, -18],
    [18, -18],
  ],
  'right-down': [
    [-20, -10],
    [-20, 18],
    [18, 18],
  ],
  'left-up': [
    [20, 10],
    [20, -18],
    [-18, -18],
  ],
  'left-down': [
    [20, -10],
    [20, 18],
    [-18, 18],
  ],
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

const WEAPON_NAME_BY_TYPE: Partial<Record<WeaponType, string>> = {
  lightning: 'LIGHT',
};

const SUPPORT_NAME_BY_TYPE: Record<SupportType, string> = {
  'damage-booster': 'ATK',
  'gold-booster': 'GOLD',
  'crit-booster': 'CRIT',
  'charge-booster': 'CHG',
};

/** 纯样式映射层，只负责把方向语义转换成渲染偏移。 */
export function getDirectionOffsetComponents(direction: Direction): [number, number, number] {
  return [...DIRECTION_OFFSET_BY_DIRECTION[direction]];
}

/** 纯样式映射层，只负责把转向器语义转换成折线路径。 */
export function getTurnerGlyphPath(variant: TurnerVariant): Point2[] {
  return TURNER_GLYPH_PATH_BY_VARIANT[variant].map((point) => [...point]);
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

/** 武器文案映射集中收口，避免个别武器缩写规则散落在渲染层。 */
export function formatWeaponName(weaponType: WeaponType): string {
  return WEAPON_NAME_BY_TYPE[weaponType] ?? weaponType.toUpperCase();
}

/** 辅助实体短名集中收口，供 fallback、调试文本和后续 UI 提示复用。 */
export function formatSupportName(supportType: SupportType): string {
  return SUPPORT_NAME_BY_TYPE[supportType];
}
