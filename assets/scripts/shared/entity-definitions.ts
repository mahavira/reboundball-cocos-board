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

type DefinedDirection = (typeof DIRECTIONS)[number];
type DefinedTurnerVariant = (typeof TURNER_VARIANTS)[number];
type DefinedWeaponType = (typeof WEAPON_TYPES)[number];

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
