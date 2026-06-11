import { Color, Node, UITransform, Vec3 } from 'cc';

import { BOARD_CELLS, CELL_SIZE } from './board-renderer-constants.ts';
import { getDirectionOffsetComponents } from './board-renderer-style.ts';
import type { Direction, GridCoord } from '../shared/types.ts';

/** 创建普通子节点，并挂到指定父节点下。 */
export function createChild(parentNode: Node, name: string): Node {
  const node = new Node(name);
  node.setParent(parentNode);
  return node;
}

/** 确保节点具备 UITransform，并设置命中/布局尺寸。 */
export function setNodeSize(node: Node, width: number, height: number): void {
  const uiTransform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  uiTransform.setContentSize(width, height);
}

/** 棋盘格坐标转节点本地坐标。 */
export function gridToPosition(coord: GridCoord): Vec3 {
  const boardCenterIndex = (BOARD_CELLS - 1) / 2;
  const x = (coord.col - boardCenterIndex) * CELL_SIZE;
  const y = (boardCenterIndex - coord.row) * CELL_SIZE;
  return new Vec3(x, y, 0);
}

/** 方向转偏移，主要用于武器尾巴位置。 */
export function directionToOffset(direction: Direction): Vec3 {
  const [x, y, z] = getDirectionOffsetComponents(direction);
  return new Vec3(x, y, z);
}

/** 统一把纯样式层返回的 RGBA 元组转换成 Cocos Color。 */
export function createColor(rgba: readonly [number, number, number, number]): Color {
  return new Color(rgba[0], rgba[1], rgba[2], rgba[3]);
}
