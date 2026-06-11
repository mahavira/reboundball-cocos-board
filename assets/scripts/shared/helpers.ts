import type { Direction, GridCoord } from './types.ts';

/** 复制坐标值对象，避免调用方共享可变引用。 */
export function cloneCoord(coord: GridCoord): GridCoord {
  return { row: coord.row, col: coord.col };
}

/** 统一棋盘坐标的 Map key 规则，避免多处手写不一致。 */
export function coordKey(coord: GridCoord): string {
  return `${coord.row},${coord.col}`;
}

/** 坐标值比较工具，避免调用方反复展开 row/col 判断。 */
export function sameCoord(left: GridCoord, right: GridCoord): boolean {
  return left.row === right.row && left.col === right.col;
}

/** 按方向返回相邻格坐标，供运行时和渲染层共用。 */
export function moveCoord(coord: GridCoord, direction: Direction): GridCoord {
  if (direction === 'up') {
    return { row: coord.row - 1, col: coord.col };
  }
  if (direction === 'down') {
    return { row: coord.row + 1, col: coord.col };
  }
  if (direction === 'left') {
    return { row: coord.row, col: coord.col - 1 };
  }
  return { row: coord.row, col: coord.col + 1 };
}

/** 返回格子在指定朝向上的边界点，供渲染轨迹插值和反弹动画共用。 */
export function getBoundaryCoord(cell: GridCoord, direction: Direction): GridCoord {
  if (direction === 'up') {
    return { row: cell.row - 0.5, col: cell.col };
  }
  if (direction === 'down') {
    return { row: cell.row + 0.5, col: cell.col };
  }
  if (direction === 'left') {
    return { row: cell.row, col: cell.col - 0.5 };
  }
  return { row: cell.row, col: cell.col + 0.5 };
}

/** 判断坐标是否位于外环，用于区分 7x7 棋盘的管道外环与内部可放置区域。 */
export function isOuterRingCoord(coord: GridCoord, boardSize: number): boolean {
  return (
    coord.row === 0 ||
    coord.row === boardSize - 1 ||
    coord.col === 0 ||
    coord.col === boardSize - 1
  );
}

/** 判断坐标是否位于内区；当前项目默认内区是 row/col 1..5。 */
export function isInnerBoardCoord(coord: GridCoord, innerMin: number, innerMax: number): boolean {
  return (
    coord.row >= innerMin &&
    coord.row <= innerMax &&
    coord.col >= innerMin &&
    coord.col <= innerMax
  );
}

/** 判断坐标是否在棋盘边界内。 */
export function isBoardCoord(coord: GridCoord, boardSize: number): boolean {
  return coord.row >= 0 && coord.row < boardSize && coord.col >= 0 && coord.col < boardSize;
}
