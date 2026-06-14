import { Node } from 'cc';

import { mountEntityVisual } from '../entity-visual/EntityVisual.ts';
import { createShopPlacementSpec } from './ShopItemFactory.ts';
import type { BoardDragItemDefinition, EntitySpec, EntityState } from '../shared/types.ts';

/** 创建拖拽预览节点；位置生命周期仍由拖拽控制器/host 管理。 */
export class ShopDragPreviewRenderer {
  static createDragPreviewNode(parentNode: Node, item: BoardDragItemDefinition): Node {
    const previewNode = new Node(`DragPreview-${getDragPreviewId(item)}`);
    previewNode.setParent(parentNode);
    previewNode.setScale(1, 1, 1);
    mountEntityVisual(previewNode, toDragPreviewEntity(item));
    return previewNode;
  }
}

function getDragPreviewId(item: BoardDragItemDefinition): string {
  if ('itemId' in item) {
    return item.itemId;
  }
  return `board-${item.kind}-${item.coord.row}-${item.coord.col}`;
}

function toDragPreviewEntity(item: BoardDragItemDefinition): EntitySpec | EntityState {
  return 'itemId' in item
    ? createShopPlacementSpec(item, { row: 0, col: 0 })
    : item;
}
