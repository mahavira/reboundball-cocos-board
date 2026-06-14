/** 所有弹球移动方向，顺序同时用于顺时针方向推导。 */
export const DIRECTIONS = ['up', 'right', 'down', 'left'] as const;

/** 所有转向器变体，命名规则为「水平方向-垂直方向」。 */
export const TURNER_VARIANTS = [
  'right-up',
  'right-down',
  'left-up',
  'left-down',
] as const;

/** 当前棋盘系统支持的武器类型。 */
export const WEAPON_TYPES = ['pistol', 'bomb', 'laser', 'lightning'] as const;

/** 当前棋盘系统支持的辅助实体类型。 */
export const SUPPORT_TYPES = [
  'damage-booster',
  'gold-booster',
  'crit-booster',
  'charge-booster',
] as const;

type DefinedDirection = (typeof DIRECTIONS)[number];
type DefinedTurnerVariant = (typeof TURNER_VARIANTS)[number];
type DefinedWeaponType = (typeof WEAPON_TYPES)[number];
type DefinedSupportType = (typeof SUPPORT_TYPES)[number];

/** 转向器/旋转器的等级-速度倍率表。 */
export const LEVEL_SPEED_MULTIPLIERS: Readonly<Partial<Record<number, number>>> = {
  1: 1.5,
  2: 2.5,
  3: 3.5,
  4: 4.5,
  5: 6,
} as const;

/** 各武器类型的充能上限，达到后自动开火并归零。 */
export const WEAPON_CHARGE_LIMITS: Readonly<Record<DefinedWeaponType, number>> = {
  pistol: 2,
  bomb: 3,
  laser: 4,
  lightning: 5,
} as const;

/** 辅助实体效果表，读取时通过 getSupportLevelIndex 统一做等级钳制。 */
export const SUPPORT_EFFECTS_BY_TYPE: Readonly<{
  'damage-booster': { damageMultiplierBonusByLevel: readonly number[] };
  'gold-booster': { onKillGoldBonusByLevel: readonly number[] };
  'crit-booster': { critChanceBonusByLevel: readonly number[] };
  'charge-booster': { chargeGainMultiplierBonusByLevel: readonly number[] };
}> = {
  'damage-booster': {
    damageMultiplierBonusByLevel: [0.2, 0.35, 0.5, 0.65, 0.8],
  },
  'gold-booster': {
    onKillGoldBonusByLevel: [1, 2, 3, 4, 5],
  },
  'crit-booster': {
    critChanceBonusByLevel: [0.1, 0.15, 0.2, 0.25, 0.3],
  },
  'charge-booster': {
    chargeGainMultiplierBonusByLevel: [0.2, 0.35, 0.5, 0.65, 0.8],
  },
} as const satisfies Readonly<Record<DefinedSupportType, object>>;

/** 方向反转查找表，用于弹球被阻挡时反弹。 */
export const OPPOSITE_DIRECTION: Readonly<Record<DefinedDirection, DefinedDirection>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
} as const;

/** 方向顺时针旋转查找表。 */
export const CLOCKWISE_DIRECTION_BY_DIRECTION: Readonly<Record<DefinedDirection, DefinedDirection>> = {
  up: 'right',
  right: 'down',
  down: 'left',
  left: 'up',
} as const;

/** 转向器变体顺时针旋转查找表。 */
export const CLOCKWISE_VARIANT_BY_VARIANT: Readonly<Record<DefinedTurnerVariant, DefinedTurnerVariant>> = {
  'right-up': 'right-down',
  'right-down': 'left-down',
  'left-down': 'left-up',
  'left-up': 'right-up',
} as const;

/** 转向器入口边到出口方向的映射。 */
export const TURNER_EXIT_DIRECTION_BY_VARIANT: Readonly<
  Record<DefinedTurnerVariant, Partial<Record<DefinedDirection, DefinedDirection>>>
> = {
  'right-up': {
    right: 'up',
    up: 'right',
  },
  'right-down': {
    right: 'down',
    down: 'right',
  },
  'left-up': {
    left: 'up',
    up: 'left',
  },
  'left-down': {
    left: 'down',
    down: 'left',
  },
} as const;

/** 将 1 起始等级转换为安全数组下标，超过当前配置上限时使用最高等级效果。 */
export function getSupportLevelIndex(level: number): number {
  return Math.min(4, Math.max(0, Math.floor(level) - 1));
}
