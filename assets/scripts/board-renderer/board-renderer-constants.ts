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

export type PlacementHighlightState = 'placeable' | 'mergeable' | 'blocked';
