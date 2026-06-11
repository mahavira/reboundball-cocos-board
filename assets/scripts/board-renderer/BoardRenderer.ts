import { Color, Graphics, Node, UITransform, Vec3 } from 'cc';

import { mountEntityVisual } from './BoardEntityVisual.ts';
import {
  BALL_RADIUS,
  BOARD_CELLS,
  BOARD_SIZE_PX,
  CELL_SIZE,
  SHOP_ICON_SCALE,
  type PlacementHighlightState,
} from './board-renderer-constants.ts';
import { createChild, createColor, gridToPosition, setNodeSize } from './board-renderer-node-utils.ts';
import { createDashedPredictionPolylines } from '../board-prediction/board-prediction-render-utils.ts';
import { getGridFillRgba, getPlacementHighlightPalette } from './board-renderer-style.ts';
import { createShopPlacementSpec } from '../shop/ShopItemFactory.ts';
import type {
  BallRenderState,
  BoardDragItemDefinition,
  EntitySpec,
  EntityState,
  GridCoord,
  PredictionPathResult,
  ShopItemDefinition,
  UiPoint,
} from '../shared/types.ts';

const BOARD_LAYER_NAME = 'BoardLayerNode';

const RENDER_LAYERS = {
  grid: 'BoardGridLayer',
  entity: 'BoardEntityLayer',
  prediction: 'BoardPredictionLayer',
  dragHighlight: 'BoardDragHighlightLayer',
  ball: 'BoardBallLayer',
} as const;

/**
 * 棋盘渲染器。
 *
 * 职责：
 * - 管理棋盘节点层级和静态网格
 * - 重建实体层和弹球节点
 * - 更新拖拽高亮、预测路径和弹球位置
 *
 * 不负责：
 * - 运行时状态计算
 * - 动画时序推进
 * - 业务事件派发
 * - 具体实体图形绘制
 */
export class BoardRenderer {
  private readonly rootNode: Node;
  private boardLayerNode!: Node;
  private boardGridLayerNode!: Node;
  private boardEntityLayerNode!: Node;
  private boardPredictionLayerNode!: Node;
  private boardBallLayerNode!: Node;
  private boardDragHighlightLayerNode!: Node;
  private dragHighlightNode: Node | null = null;
  private readonly ballNodeMap = new Map<string, Node>();

  constructor(rootNode: Node) {
    this.rootNode = rootNode;
  }

  /** 初始化渲染节点和静态网格，只需执行一次。 */
  initialize(): void {
    this.ensureRootNodes();
    this.ensureRenderLayers();
    this.renderStaticGrid();
  }

  /** 用最新实体快照重建整个实体层。 */
  rebuildEntityLayer(entities: EntityState[]): void {
    this.boardEntityLayerNode.destroyAllChildren();

    for (const entity of entities) {
      this.createPlacedEntityNode(entity);
    }
  }

  /** 同步弹球节点集合：删除多余节点，并为新弹球补建渲染节点。 */
  syncBallNodes(ballStates: BallRenderState[]): void {
    this.removeStaleBallNodes(ballStates);
    this.createMissingBallNodes(ballStates);
  }

  /** 把不在活动动画中的弹球同步回运行时当前位置。 */
  syncIdleBallNodes(ballStates: BallRenderState[], activeBallIds: ReadonlySet<string>): void {
    for (const ball of ballStates) {
      if (activeBallIds.has(ball.ballId)) {
        continue;
      }
      this.setBallPosition(ball.ballId, ball.cell);
    }
  }

  /** 更新单颗弹球的渲染位置；节点不存在时返回 false。 */
  setBallPosition(ballId: string, coord: GridCoord): boolean {
    const ballNode = this.ballNodeMap.get(ballId);
    if (!ballNode) {
      return false;
    }
    ballNode.setPosition(gridToPosition(coord));
    return true;
  }

  /** 清空共享预测路径，避免布局变化后残留旧轨迹。 */
  clearPredictionPath(): void {
    this.boardPredictionLayerNode.destroyAllChildren();
  }

  /** 渲染共享预测路径。这里只消费纯预测结果，不参与任何运行时推演。 */
  renderPredictionPath(prediction: PredictionPathResult): void {
    this.clearPredictionPath();
    if (prediction.isEmpty || prediction.segments.length === 0) {
      return;
    }

    const pathNode = createChild(this.boardPredictionLayerNode, 'PredictionPathNode');
    const graphics = pathNode.addComponent(Graphics);
    graphics.strokeColor = new Color(251, 191, 36, 220);
    graphics.lineWidth = 2;
    graphics.lineCap = Graphics.LineCap.BUTT;
    graphics.lineJoin = Graphics.LineJoin.ROUND;

    const pathPoints = [
      gridToPosition(prediction.segments[0].from),
      ...prediction.segments.map((segment) => gridToPosition(segment.to)),
    ];

    for (const dashedPolyline of createDashedPredictionPolylines(pathPoints)) {
      if (dashedPolyline.length === 0) {
        continue;
      }

      graphics.moveTo(dashedPolyline[0].x, dashedPolyline[0].y);
      for (let index = 1; index < dashedPolyline.length; index += 1) {
        graphics.lineTo(dashedPolyline[index].x, dashedPolyline[index].y);
      }
    }
    graphics.stroke();
  }

  /** 把屏幕/UI 坐标转换成棋盘格坐标；超出棋盘区域时返回 null。 */
  resolveGridCoordFromUiPoint(uiPoint: UiPoint): GridCoord | null {
    const boardTransform = this.boardLayerNode.getComponent(UITransform);
    if (!boardTransform) {
      return null;
    }

    const localPoint = boardTransform.convertToNodeSpaceAR(new Vec3(uiPoint.x, uiPoint.y, 0));
    if (!this.isPointInsideBoard(localPoint)) {
      return null;
    }

    return this.localPointToGridCoord(localPoint);
  }

  /** 拖拽时显示目标格反馈：浅绿=可放置，黄色=可合并，红色=不可放置。 */
  showPlacementHighlight(coord: GridCoord, state: PlacementHighlightState): void {
    const highlightNode = this.ensureDragHighlightNode();
    highlightNode.active = true;
    highlightNode.setPosition(gridToPosition(coord));

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

  /** 清理拖拽高亮，避免拖拽取消后残留旧状态。 */
  clearPlacementHighlight(): void {
    if (!this.dragHighlightNode) {
      return;
    }
    this.dragHighlightNode.active = false;
  }

  /** 在目标容器中渲染商店商品图标，复用棋盘实体表现语义。 */
  static renderShopItemIcon(targetNode: Node, item: ShopItemDefinition | null): void {
    targetNode.destroyAllChildren();
    if (!item) {
      return;
    }

    const iconNode = new Node('ShopItemIcon');
    iconNode.setParent(targetNode);
    iconNode.setScale(SHOP_ICON_SCALE, SHOP_ICON_SCALE, 1);
    mountEntityVisual(iconNode, createShopPlacementSpec(item, { row: 0, col: 0 }));
  }

  /** 创建拖拽预览节点；位置更新由外层拖拽控制器负责。 */
  static createDragPreviewNode(parentNode: Node, item: BoardDragItemDefinition): Node {
    const previewNode = new Node(`DragPreview-${getDragPreviewId(item)}`);
    previewNode.setParent(parentNode);
    previewNode.setScale(1, 1, 1);
    mountEntityVisual(previewNode, toDragPreviewEntity(item));
    return previewNode;
  }

  /** 兼容旧调用方：实体绘制实际已下沉到 BoardEntityVisual。 */
  static mountEntityVisual(targetNode: Node, entity: EntitySpec | EntityState): void {
    mountEntityVisual(targetNode, entity);
  }

  private createPlacedEntityNode(entity: EntityState): void {
    const entityRootNode = createChild(
      this.boardEntityLayerNode,
      `Entity-${entity.coord.row}-${entity.coord.col}`,
    );
    /**
     * 已放置实体支持直接拖拽。
     * Cocos 指针命中检测要求挂事件的节点本身具备 UITransform，
     * 否则鼠标移动阶段可能在事件分发里读到空的 cameraPriority。
     */
    setNodeSize(entityRootNode, CELL_SIZE, CELL_SIZE);
    entityRootNode.setPosition(gridToPosition(entity.coord));
    mountEntityVisual(entityRootNode, entity);
  }

  private removeStaleBallNodes(ballStates: BallRenderState[]): void {
    const currentBallIds = new Set(ballStates.map((ball) => ball.ballId));

    for (const [ballId, node] of this.ballNodeMap.entries()) {
      if (currentBallIds.has(ballId)) {
        continue;
      }
      node.destroy();
      this.ballNodeMap.delete(ballId);
    }
  }

  private createMissingBallNodes(ballStates: BallRenderState[]): void {
    for (const ball of ballStates) {
      if (this.ballNodeMap.has(ball.ballId)) {
        continue;
      }

      const ballNode = this.createBallNode(ball);
      this.ballNodeMap.set(ball.ballId, ballNode);
    }
  }

  private createBallNode(ball: BallRenderState): Node {
    const ballNode = createChild(this.boardBallLayerNode, `Ball-${ball.ballId}`);
    setNodeSize(ballNode, BALL_RADIUS * 2, BALL_RADIUS * 2);

    const graphics = ballNode.addComponent(Graphics);
    graphics.fillColor = ball.isFast ? new Color(248, 113, 113, 255) : new Color(250, 250, 250, 250);
    graphics.circle(0, 0, BALL_RADIUS);
    graphics.fill();
    return ballNode;
  }

  private ensureRootNodes(): void {
    this.boardLayerNode = this.rootNode.getChildByName(BOARD_LAYER_NAME)
      ?? createChild(this.rootNode, BOARD_LAYER_NAME);
    setNodeSize(this.rootNode, BOARD_SIZE_PX, BOARD_SIZE_PX);
    setNodeSize(this.boardLayerNode, BOARD_SIZE_PX, BOARD_SIZE_PX);
  }

  private ensureRenderLayers(): void {
    this.boardGridLayerNode = this.ensureLayer(RENDER_LAYERS.grid);
    this.boardEntityLayerNode = this.ensureLayer(RENDER_LAYERS.entity);
    this.boardPredictionLayerNode = this.ensureLayer(RENDER_LAYERS.prediction);
    this.boardDragHighlightLayerNode = this.ensureLayer(RENDER_LAYERS.dragHighlight);
    this.boardBallLayerNode = this.ensureLayer(RENDER_LAYERS.ball);
  }

  private ensureLayer(layerName: string): Node {
    const layerNode = this.boardLayerNode.getChildByName(layerName)
      ?? createChild(this.boardLayerNode, layerName);
    setNodeSize(layerNode, BOARD_SIZE_PX, BOARD_SIZE_PX);
    return layerNode;
  }

  private renderStaticGrid(): void {
    if (this.boardGridLayerNode.children.length > 0) {
      return;
    }

    for (let row = 0; row < BOARD_CELLS; row += 1) {
      for (let col = 0; col < BOARD_CELLS; col += 1) {
        this.createGridCell({ row, col });
      }
    }
  }

  private createGridCell(coord: GridCoord): void {
    const cellNode = createChild(this.boardGridLayerNode, `Grid-${coord.row}-${coord.col}`);
    cellNode.setPosition(gridToPosition(coord));
    setNodeSize(cellNode, CELL_SIZE - 2, CELL_SIZE - 2);

    const graphics = cellNode.addComponent(Graphics);
    graphics.fillColor = createColor(getGridFillRgba(coord));
    graphics.strokeColor = new Color(28, 39, 64, 255);
    graphics.lineWidth = 2;
    graphics.roundRect(-(CELL_SIZE - 2) / 2, -(CELL_SIZE - 2) / 2, CELL_SIZE - 2, CELL_SIZE - 2, 10);
    graphics.fill();
    graphics.stroke();
  }

  private ensureDragHighlightNode(): Node {
    if (this.dragHighlightNode) {
      return this.dragHighlightNode;
    }

    this.dragHighlightNode = createChild(this.boardDragHighlightLayerNode, 'DragHighlightNode');
    setNodeSize(this.dragHighlightNode, CELL_SIZE, CELL_SIZE);
    this.dragHighlightNode.addComponent(Graphics);
    this.dragHighlightNode.active = false;
    return this.dragHighlightNode;
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
