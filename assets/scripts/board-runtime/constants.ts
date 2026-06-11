import type { GridCoord } from '../shared/types.ts';

/** 棋盘总尺寸：外环 1 格管道 + 内部 5×5 可放置区域。 */
export const BOARD_SIZE = 7;

/** 默认入口：左侧中线。弹球从入口向右进入内部棋盘。 */
export const DEFAULT_ENTRY: GridCoord = { row: 3, col: 0 };

/** 默认单步基础时长。 */
export const DEFAULT_BASE_STEP_MS = 800;
