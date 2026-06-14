import { Graphics, Node } from 'cc';

import type { BoardCoordinateMapper } from './BoardCoordinateMapper.ts';
import { CELL_SIZE, type PlacementHighlightState } from './board-renderer-constants.ts';
import { createChild, createColor, setNodeSize } from './board-renderer-node-utils.ts';
import { getPlacementHighlightPalette } from './board-renderer-style.ts';
import type { GridCoord } from '../shared/types.ts';

type BoardPlacementHighlightRendererOptions = {
  getDragHighlightLayerNode: () => Node;
  coordinateMapper: BoardCoordinateMapper;
};

/** 绘制拖拽落点高亮，不参与放置规则判断。 */
export class BoardPlacementHighlightRenderer {
  private readonly getDragHighlightLayerNode: () => Node;
  private readonly coordinateMapper: BoardCoordinateMapper;
  private dragHighlightNode: Node | null = null;

  constructor(options: BoardPlacementHighlightRendererOptions) {
    this.getDragHighlightLayerNode = options.getDragHighlightLayerNode;
    this.coordinateMapper = options.coordinateMapper;
  }

  show(coord: GridCoord, state: PlacementHighlightState): void {
    const highlightNode = this.ensureDragHighlightNode();
    highlightNode.active = true;
    highlightNode.setPosition(this.coordinateMapper.getCachedGridPosition(coord));

    const graphics = highlightNode.getComponent(Graphics);
    if (!graphics) {
      return;
    }

    const palette = getPlacementHighlightPalette(state);
    graphics.clear();
    graphics.lineWidth = 4;
    graphics.fillColor = createColor(palette.fill);
    graphics.strokeColor = createColor(palette.stroke);
    graphics.roundRect(-(CELL_SIZE - 8) / 2, -(CELL_SIZE - 8) / 2, CELL_SIZE - 8, CELL_SIZE - 8, 12);
    graphics.fill();
    graphics.stroke();
  }

  clear(): void {
    if (!this.dragHighlightNode) {
      return;
    }
    this.dragHighlightNode.active = false;
  }

  private ensureDragHighlightNode(): Node {
    if (this.dragHighlightNode) {
      return this.dragHighlightNode;
    }

    this.dragHighlightNode = createChild(this.getDragHighlightLayerNode(), 'DragHighlightNode');
    setNodeSize(this.dragHighlightNode, CELL_SIZE, CELL_SIZE);
    this.dragHighlightNode.addComponent(Graphics);
    this.dragHighlightNode.active = false;
    return this.dragHighlightNode;
  }
}
