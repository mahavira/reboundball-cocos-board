import { Color } from 'cc';

/** 棋盘格数（7×7） */
export const BOARD_CELLS = 7;
/** 单个格子的像素尺寸 */
export const CELL_SIZE = 84;
/** 棋盘总像素尺寸 */
export const BOARD_SIZE_PX = CELL_SIZE * BOARD_CELLS;
/** 弹球渲染半径（像素） */
export const BALL_RADIUS = 10;

/**
 * 这些尺寸常量只服务当前静态棋盘渲染比例。
 * 它们与 CELL_SIZE 绑定，而不是放进运行时配置，避免把纯表现语义混入棋盘规则层。
 */
export const ENTITY_BODY_SIZE = CELL_SIZE - 14;
export const ENTITY_HALF_BODY = 30;
export const ENTITY_CORNER_RADIUS = 10;
export const ENTITY_LARGE_CORNER_RADIUS = 12;

export const WEAPON_BODY_SIZE = 56;
export const WEAPON_HALF_BODY = 28;
export const WEAPON_TAIL_RADIUS = 12;
export const WEAPON_TAIL_SIZE = WEAPON_TAIL_RADIUS * 2;

export const SHOP_ICON_SCALE = 1;

export type PlacementHighlightState = 'placeable' | 'mergeable' | 'blocked';

export const LEVEL_COLORS: readonly Color[] = [
  new Color(255, 255, 255, 255),
  new Color(74, 222, 128, 255),
  new Color(96, 165, 250, 255),
  new Color(251, 146, 60, 255),
  new Color(239, 68, 68, 255),
];
