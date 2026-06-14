import { Color } from 'cc';

/** 棋盘格数（7×7） */
export const BOARD_CELLS = 7;
/** 单个格子的像素尺寸 */
export const CELL_SIZE = 84;
/** 棋盘总像素尺寸 */
export const BOARD_SIZE_PX = CELL_SIZE * BOARD_CELLS;
/** 弹球渲染半径（像素） */
export const BALL_RADIUS = 10;
/** 弹球图片资源路径，指向 resources/images/ball.png 的 SpriteFrame。 */
export const BALL_SPRITE_FRAME_PATH = 'images/ball/spriteFrame';
/** 武器尾巴图片资源路径，指向 resources/images/weapon-tail.png 的 SpriteFrame。 */
export const WEAPON_TAIL_SPRITE_FRAME_PATH = 'images/weapon-tail/spriteFrame';

/**
 * 这些尺寸常量只服务当前静态棋盘渲染比例。
 * 它们与 CELL_SIZE 绑定，而不是放进运行时配置，避免把纯表现语义混入棋盘规则层。
 */
export const ENTITY_BODY_SIZE = CELL_SIZE;
export const ENTITY_HALF_BODY = CELL_SIZE / 2;
export const ENTITY_CORNER_RADIUS = 10;
export const ENTITY_LARGE_CORNER_RADIUS = 12;

export const WEAPON_BODY_SIZE = CELL_SIZE;
export const WEAPON_HALF_BODY = CELL_SIZE / 2;
export const WEAPON_TAIL_RADIUS = 12;
export const WEAPON_TAIL_SIZE = WEAPON_TAIL_RADIUS * 2;
export const WEAPON_TAIL_IMAGE_WIDTH = 27;
export const WEAPON_TAIL_IMAGE_HEIGHT = 62;
/** weapon-tail.png 内齿轮中心相对整图中心的 Y 偏移，缩放到当前显示尺寸后使用。 */
export const WEAPON_TAIL_GEAR_CENTER_OFFSET_Y = 17;
export const WEAPON_TAIL_GEAR_IMAGE_SIZE = 31;
export const WEAPON_TAIL_GEAR_RAW_SIZE = 114;

export const SHOP_ICON_SCALE = 1;

export type PlacementHighlightState = 'placeable' | 'mergeable' | 'blocked';

export const LEVEL_COLORS: readonly Color[] = [
  new Color(255, 255, 255, 255),
  new Color(74, 222, 128, 255),
  new Color(96, 165, 250, 255),
  new Color(251, 146, 60, 255),
  new Color(239, 68, 68, 255),
];
