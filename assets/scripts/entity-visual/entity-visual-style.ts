import type { SupportType, TurnerVariant, WeaponType } from '../shared/types.ts';

type Point2 = readonly [number, number];

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

const WEAPON_NAME_BY_TYPE: Partial<Record<WeaponType, string>> = {
  lightning: 'LIGHT',
};

const SUPPORT_NAME_BY_TYPE: Record<SupportType, string> = {
  'damage-booster': 'ATK',
  'gold-booster': 'GOLD',
  'crit-booster': 'CRIT',
  'charge-booster': 'CHG',
};

/** 纯样式映射层，只负责把转向器语义转换成折线路径。 */
export function getTurnerGlyphPath(variant: TurnerVariant): Point2[] {
  return TURNER_GLYPH_PATH_BY_VARIANT[variant].map((point) => [...point]);
}

/** 武器文案映射集中收口，避免个别武器缩写规则散落在渲染层。 */
export function formatWeaponName(weaponType: WeaponType): string {
  return WEAPON_NAME_BY_TYPE[weaponType] ?? weaponType.toUpperCase();
}

/** 辅助实体短名集中收口，供 fallback、调试文本和后续 UI 提示复用。 */
export function formatSupportName(supportType: SupportType): string {
  return SUPPORT_NAME_BY_TYPE[supportType];
}
