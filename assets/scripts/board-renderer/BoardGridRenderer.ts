import { Color, Graphics, Node } from 'cc';

import { BOARD_CELLS, CELL_SIZE } from './board-renderer-constants.ts';
import type { BoardCoordinateMapper } from './BoardCoordinateMapper.ts';
import { createChild, createColor, setNodeSize } from './board-renderer-node-utils.ts';
import { getGridFillRgba } from './board-renderer-style.ts';
import type { GridCoord } from '../shared/types.ts';

type BoardGridRendererOptions = {
  getGridLayerNode: () => Node;
  coordinateMapper: BoardCoordinateMapper;
};

/** 绘制静态 7×7 棋盘格，不负责 pipe 或 entity。 */
export class BoardGridRenderer {
  private readonly getGridLayerNode: () => Node;
  private readonly coordinateMapper: BoardCoordinateMapper;

  constructor(options: BoardGridRendererOptions) {
    this.getGridLayerNode = options.getGridLayerNode;
    this.coordinateMapper = options.coordinateMapper;
  }

  render(): void {
    const gridLayerNode = this.getGridLayerNode();
    if (gridLayerNode.children.length > 0) {
      return;
    }

    for (let row = 0; row < BOARD_CELLS; row += 1) {
      for (let col = 0; col < BOARD_CELLS; col += 1) {
        this.createGridCell({ row, col });
      }
    }
  }

  private createGridCell(coord: GridCoord): void {
    const cellNode = createChild(this.getGridLayerNode(), `Grid-${coord.row}-${coord.col}`);
    cellNode.setPosition(this.coordinateMapper.getCachedGridPosition(coord));
    setNodeSize(cellNode, CELL_SIZE - 2, CELL_SIZE - 2);

    const graphics = cellNode.addComponent(Graphics);
    graphics.fillColor = createColor(getGridFillRgba(coord));
    graphics.strokeColor = new Color(28, 39, 64, 255);
    graphics.lineWidth = 2;
    graphics.roundRect(-(CELL_SIZE - 2) / 2, -(CELL_SIZE - 2) / 2, CELL_SIZE - 2, CELL_SIZE - 2, 10);
    graphics.fill();
    graphics.stroke();
  }
}
