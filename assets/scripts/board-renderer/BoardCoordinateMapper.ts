import { Node, UITransform, Vec3 } from 'cc';

import { BOARD_CELLS, BOARD_SIZE_PX, CELL_SIZE } from './board-renderer-constants.ts';
import { gridToPosition } from './board-renderer-node-utils.ts';
import { coordKey } from '../shared/helpers.ts';
import type { GridCoord, UiPoint } from '../shared/types.ts';

/** 负责棋盘坐标、动画坐标和 UI 点之间的转换。 */
export class BoardCoordinateMapper {
  private readonly getBoardLayerNode: () => Node;
  private readonly gridPositionCache = new Map<string, Vec3>();

  constructor(getBoardLayerNode: () => Node) {
    this.getBoardLayerNode = getBoardLayerNode;
  }

  getCachedGridPosition(coord: GridCoord): Vec3 {
    const key = coordKey(coord);
    const cachedPosition = this.gridPositionCache.get(key);
    if (cachedPosition) {
      return cachedPosition;
    }

    const position = gridToPosition(coord);
    this.gridPositionCache.set(key, position);
    return position;
  }

  resolveGridPosition(coord: GridCoord): Vec3 {
    if (Number.isInteger(coord.row) && Number.isInteger(coord.col)) {
      return this.getCachedGridPosition(coord);
    }
    return gridToPosition(coord);
  }

  resolveGridCoordFromUiPoint(uiPoint: UiPoint): GridCoord | null {
    const boardTransform = this.getBoardLayerNode().getComponent(UITransform);
    if (!boardTransform) {
      return null;
    }

    const localPoint = boardTransform.convertToNodeSpaceAR(new Vec3(uiPoint.x, uiPoint.y, 0));
    if (!this.isPointInsideBoard(localPoint)) {
      return null;
    }

    return this.localPointToGridCoord(localPoint);
  }

  private isPointInsideBoard(localPoint: Vec3): boolean {
    const halfBoardSize = BOARD_SIZE_PX / 2;
    return (
      localPoint.x >= -halfBoardSize
      && localPoint.x <= halfBoardSize
      && localPoint.y >= -halfBoardSize
      && localPoint.y <= halfBoardSize
    );
  }

  private localPointToGridCoord(localPoint: Vec3): GridCoord {
    const halfBoardSize = BOARD_SIZE_PX / 2;
    return {
      col: this.toCellIndex((localPoint.x + halfBoardSize) / CELL_SIZE),
      row: this.toCellIndex((halfBoardSize - localPoint.y) / CELL_SIZE),
    };
  }

  private toCellIndex(value: number): number {
    return Math.min(BOARD_CELLS - 1, Math.max(0, Math.floor(value)));
  }
}
