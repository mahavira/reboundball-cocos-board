import { Color, Graphics, instantiate, Node, Prefab, resources, Sprite, SpriteFrame, tween, Tween, UITransform, Vec3 } from 'cc';

import { mountEntityVisual } from './BoardEntityVisual.ts';
import {
  BALL_RADIUS,
  BALL_SPRITE_FRAME_PATH,
  BOARD_CELLS,
  BOARD_SIZE_PX,
  CELL_SIZE,
  SHOP_ICON_SCALE,
  type PlacementHighlightState,
} from './board-renderer-constants.ts';
import { createChild, createColor, gridToPosition, setNodeSize } from './board-renderer-node-utils.ts';
import { createDashedPredictionPolylines } from '../board-prediction/board-prediction-render-utils.ts';
import {
  collectActiveSupportAuraState,
  type ActiveSupportAuraState,
} from '../board-runtime/SupportAuraActivation.ts';
import { buildPipePath } from '../board-runtime/board-runtime-rules.ts';
import { BOARD_SIZE, DEFAULT_ENTRY } from '../board-runtime/constants.ts';
import { getGridFillRgba, getPlacementHighlightPalette } from './board-renderer-style.ts';
import { createShopPlacementSpec } from '../shop/ShopItemFactory.ts';
import { coordKey } from '../shared/helpers.ts';
import type {
  BallRenderState,
  BoardDragItemDefinition,
  Direction,
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
  pipe: 'BoardPipeLayer',
  entity: 'BoardEntityLayer',
  prediction: 'BoardPredictionLayer',
  dragHighlight: 'BoardDragHighlightLayer',
  ball: 'BoardBallLayer',
} as const;

const PIPE_NODE_PREFAB_PATH = 'prefabs/PipeNode';
const PIPE_BEND_PREFAB_PATH = 'prefabs/PipeBend';

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
  private boardPipeLayerNode!: Node;
  private boardEntityLayerNode!: Node;
  private boardPredictionLayerNode!: Node;
  private boardBallLayerNode!: Node;
  private boardDragHighlightLayerNode!: Node;
  private pipeNodePrefab: Prefab | null = null;
  private pipeBendPrefab: Prefab | null = null;
  private ballSpriteFrame: SpriteFrame | null = null;
  private isPipePrefabLoadStarted = false;
  private isBallSpriteLoadStarted = false;
  private dragHighlightNode: Node | null = null;
  private predictionPathNode: Node | null = null;
  private predictionPathGraphics: Graphics | null = null;
  private readonly ballNodeMap = new Map<string, Node>();
  private readonly currentBallIds = new Set<string>();
  private readonly entityNodeMap = new Map<string, Node>();
  private readonly gridPositionCache = new Map<string, Vec3>();

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
    this.entityNodeMap.clear();

    const activeSupportAuraState = collectActiveSupportAuraState(entities);
    for (const entity of entities) {
      this.createPlacedEntityNode(entity, getEntitySupportAuraLightDirection(entity, activeSupportAuraState));
    }
  }

  /** 只刷新发生变化的实体格，避免单个充能/耐久变化重建整个实体层。 */
  updateEntityNode(coord: GridCoord, entity: EntityState | null): void {
    const key = coordKey(coord);
    const oldNode = this.entityNodeMap.get(key);
    if (oldNode) {
      oldNode.destroy();
      this.entityNodeMap.delete(key);
    }

    if (!entity) {
      return;
    }

    this.createPlacedEntityNode(entity, null);
  }

  /** 播放武器尾巴充能反馈；只命中本次经过的尾巴格，不连带同武器其他尾巴。 */
  playWeaponTailChargeFeedback(weaponCoord: GridCoord, tailCoord: GridCoord): void {
    const entityNode = this.entityNodeMap.get(coordKey(weaponCoord));
    if (!entityNode) {
      return;
    }

    const tailNodeNamePrefix = `EntityTailNode-${tailCoord.row}-${tailCoord.col}-`;
    for (const tailNode of entityNode.children.filter((child) => child.name.startsWith(tailNodeNamePrefix))) {
      Tween.stopAllByTarget(tailNode);
      tailNode.setRotationFromEuler(0, 0, 0);
      tween(tailNode)
        .to(0.05, { eulerAngles: new Vec3(0, 0, 7) })
        .to(0.08, { eulerAngles: new Vec3(0, 0, -6) })
        .to(0.06, { eulerAngles: new Vec3(0, 0, 3) })
        .to(0.05, { eulerAngles: new Vec3(0, 0, 0) })
        .start();
      this.playWeaponTailGearChargeFeedback(tailNode);
    }
  }

  private playWeaponTailGearChargeFeedback(tailNode: Node): void {
    const gearNode = tailNode.getChildByName('WeaponTailGearNode');
    if (!gearNode) {
      return;
    }

    Tween.stopAllByTarget(gearNode);
    gearNode.setRotationFromEuler(0, 0, 0);
    tween(gearNode)
      .by(0.07, { eulerAngles: new Vec3(0, 0, -180) })
      .by(0.12, { eulerAngles: new Vec3(0, 0, -130) })
      .by(0.18, { eulerAngles: new Vec3(0, 0, -70) })
      .by(0.22, { eulerAngles: new Vec3(0, 0, -30) })
      .start();
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
    ballNode.setPosition(this.resolveGridPosition(coord));
    return true;
  }

  /** 按视觉角速度累加弹球自转，只服务滑行动画表现。 */
  rotateBall(ballId: string, rotationDeltaDegrees: number): boolean {
    const ballNode = this.ballNodeMap.get(ballId);
    if (!ballNode) {
      return false;
    }

    const currentEuler = ballNode.eulerAngles;
    ballNode.setRotationFromEuler(currentEuler.x, currentEuler.y, currentEuler.z + rotationDeltaDegrees);
    return true;
  }

  /** 清空共享预测路径，避免布局变化后残留旧轨迹。 */
  clearPredictionPath(): void {
    const graphics = this.ensurePredictionPathGraphics();
    graphics.clear();
    if (this.predictionPathNode) {
      this.predictionPathNode.active = false;
    }
  }

  /** 渲染共享预测路径。这里只消费纯预测结果，不参与任何运行时推演。 */
  renderPredictionPath(prediction: PredictionPathResult): void {
    const graphics = this.ensurePredictionPathGraphics();
    graphics.clear();

    if (prediction.isEmpty || prediction.segments.length === 0) {
      if (this.predictionPathNode) {
        this.predictionPathNode.active = false;
      }
      return;
    }

    if (this.predictionPathNode) {
      this.predictionPathNode.active = true;
    }

    graphics.strokeColor = new Color(251, 191, 36, 220);
    graphics.lineWidth = 2;
    graphics.lineCap = Graphics.LineCap.BUTT;
    graphics.lineJoin = Graphics.LineJoin.ROUND;

    const pathPoints = [
      this.getCachedGridPosition(prediction.segments[0].from),
      ...prediction.segments.map((segment) => this.getCachedGridPosition(segment.to)),
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
    highlightNode.setPosition(this.getCachedGridPosition(coord));

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

  private createPlacedEntityNode(entity: EntityState, supportAuraLightDirection: Direction | null): void {
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
    entityRootNode.setPosition(this.getCachedGridPosition(entity.coord));
    mountEntityVisual(entityRootNode, entity);
    if (supportAuraLightDirection) {
      mountSupportAuraActiveLight(entityRootNode, supportAuraLightDirection);
    }
    this.entityNodeMap.set(coordKey(entity.coord), entityRootNode);
  }

  private removeStaleBallNodes(ballStates: BallRenderState[]): void {
    this.currentBallIds.clear();
    for (const ball of ballStates) {
      this.currentBallIds.add(ball.ballId);
    }

    for (const [ballId, node] of this.ballNodeMap.entries()) {
      if (this.currentBallIds.has(ballId)) {
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
    const sprite = ballNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.applyBallSpriteFrame(sprite);
    this.loadBallSpriteFrame();
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
    this.boardPipeLayerNode = this.ensureLayer(RENDER_LAYERS.pipe);
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
    if (this.boardGridLayerNode.children.length === 0) {
      for (let row = 0; row < BOARD_CELLS; row += 1) {
        for (let col = 0; col < BOARD_CELLS; col += 1) {
          this.createGridCell({ row, col });
        }
      }
    }

    this.loadAndRenderPipePrefabs();
  }

  private createGridCell(coord: GridCoord): void {
    const cellNode = createChild(this.boardGridLayerNode, `Grid-${coord.row}-${coord.col}`);
    cellNode.setPosition(this.getCachedGridPosition(coord));
    setNodeSize(cellNode, CELL_SIZE - 2, CELL_SIZE - 2);

    const graphics = cellNode.addComponent(Graphics);
    graphics.fillColor = createColor(getGridFillRgba(coord));
    graphics.strokeColor = new Color(28, 39, 64, 255);
    graphics.lineWidth = 2;
    graphics.roundRect(-(CELL_SIZE - 2) / 2, -(CELL_SIZE - 2) / 2, CELL_SIZE - 2, CELL_SIZE - 2, 10);
    graphics.fill();
    graphics.stroke();
  }

  private loadAndRenderPipePrefabs(): void {
    if (this.isPipePrefabLoadStarted) {
      return;
    }

    this.isPipePrefabLoadStarted = true;
    resources.load(PIPE_NODE_PREFAB_PATH, Prefab, (nodeError, pipeNodePrefab) => {
      if (nodeError) {
        console.warn(`Failed to load ${PIPE_NODE_PREFAB_PATH}`, nodeError);
        return;
      }

      this.pipeNodePrefab = pipeNodePrefab;
      this.tryRenderPipePrefabLayer();
    });

    resources.load(PIPE_BEND_PREFAB_PATH, Prefab, (bendError, pipeBendPrefab) => {
      if (bendError) {
        console.warn(`Failed to load ${PIPE_BEND_PREFAB_PATH}`, bendError);
        return;
      }

      this.pipeBendPrefab = pipeBendPrefab;
      this.tryRenderPipePrefabLayer();
    });
  }

  private loadBallSpriteFrame(): void {
    if (this.ballSpriteFrame || this.isBallSpriteLoadStarted) {
      return;
    }

    this.isBallSpriteLoadStarted = true;
    resources.load(BALL_SPRITE_FRAME_PATH, SpriteFrame, (error, spriteFrame) => {
      if (error) {
        console.warn(`Failed to load ${BALL_SPRITE_FRAME_PATH}`, error);
        return;
      }

      this.ballSpriteFrame = spriteFrame;
      this.applyBallSpriteFrameToExistingBalls();
    });
  }

  private applyBallSpriteFrameToExistingBalls(): void {
    for (const ballNode of this.ballNodeMap.values()) {
      const sprite = ballNode.getComponent(Sprite);
      if (sprite) {
        this.applyBallSpriteFrame(sprite);
      }
    }
  }

  private applyBallSpriteFrame(sprite: Sprite): void {
    if (!this.ballSpriteFrame) {
      return;
    }

    sprite.spriteFrame = this.ballSpriteFrame;
  }

  private tryRenderPipePrefabLayer(): void {
    if (!this.pipeNodePrefab || !this.pipeBendPrefab) {
      return;
    }

    this.boardPipeLayerNode.destroyAllChildren();

    const pipePath = buildPipePath(BOARD_SIZE, DEFAULT_ENTRY);
    for (let index = 0; index < pipePath.length; index += 1) {
      const coord = pipePath[index];
      const previousCoord = pipePath[(index - 1 + pipePath.length) % pipePath.length];
      const nextCoord = pipePath[(index + 1) % pipePath.length];
      const segment = resolvePipePrefabSegment(previousCoord, coord, nextCoord);
      const pipeNode = instantiate(segment.isBend ? this.pipeBendPrefab : this.pipeNodePrefab);

      pipeNode.name = `Pipe-${coord.row}-${coord.col}`;
      pipeNode.setParent(this.boardPipeLayerNode);
      pipeNode.setPosition(this.getCachedGridPosition(coord));
      pipeNode.setRotationFromEuler(0, 0, segment.rotationZ);
    }
  }

  private ensurePredictionPathGraphics(): Graphics {
    if (this.predictionPathGraphics && this.predictionPathNode?.isValid) {
      return this.predictionPathGraphics;
    }

    this.predictionPathNode = createChild(this.boardPredictionLayerNode, 'PredictionPathNode');
    this.predictionPathNode.active = false;
    this.predictionPathGraphics = this.predictionPathNode.addComponent(Graphics);
    return this.predictionPathGraphics;
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

  private resolveGridPosition(coord: GridCoord): Vec3 {
    if (this.isDiscreteGridCoord(coord)) {
      return this.getCachedGridPosition(coord);
    }
    return gridToPosition(coord);
  }

  private getCachedGridPosition(coord: GridCoord): Vec3 {
    const key = coordKey(coord);
    const cachedPosition = this.gridPositionCache.get(key);
    if (cachedPosition) {
      return cachedPosition;
    }

    const position = gridToPosition(coord);
    this.gridPositionCache.set(key, position);
    return position;
  }

  private isDiscreteGridCoord(coord: GridCoord): boolean {
    return Number.isInteger(coord.row) && Number.isInteger(coord.col);
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

function getEntitySupportAuraLightDirection(
  entity: EntityState,
  auraState: ActiveSupportAuraState,
): Direction | null {
  const key = coordKey(entity.coord);
  if (entity.kind === 'weapon') {
    return auraState.activeWeaponDirectionByCoordKey.get(key) ?? null;
  }
  if (entity.kind === 'support') {
    return auraState.activeSupportDirectionByCoordKey.get(key) ?? null;
  }
  return null;
}

function mountSupportAuraActiveLight(targetNode: Node, direction: Direction): void {
  const lightNode = createChild(targetNode, 'SupportAuraActiveLightNode');
  lightNode.setPosition(getSupportAuraLightPosition(direction));
  setNodeSize(lightNode, 14, 14);

  const graphics = lightNode.addComponent(Graphics);
  graphics.fillColor = new Color(34, 197, 94, 255);
  graphics.strokeColor = new Color(220, 252, 231, 255);
  graphics.lineWidth = 2;
  graphics.circle(0, 0, 6);
  graphics.fill();
  graphics.stroke();
}

function getSupportAuraLightPosition(direction: Direction): Vec3 {
  const edgeOffset = CELL_SIZE / 2;
  switch (direction) {
    case 'up':
      return new Vec3(0, edgeOffset, 0);
    case 'right':
      return new Vec3(edgeOffset, 0, 0);
    case 'down':
      return new Vec3(0, -edgeOffset, 0);
    case 'left':
      return new Vec3(-edgeOffset, 0, 0);
  }
}

type PipeStepDirection = 'up' | 'down' | 'left' | 'right';

interface PipePrefabSegment {
  isBend: boolean;
  rotationZ: number;
}

function resolvePipePrefabSegment(previousCoord: GridCoord, coord: GridCoord, nextCoord: GridCoord): PipePrefabSegment {
  const incomingDirection = resolveStepDirection(coord, previousCoord);
  const outgoingDirection = resolveStepDirection(coord, nextCoord);

  if (isOppositePipeDirection(incomingDirection, outgoingDirection)) {
    let rotationZ = 0;
    if (incomingDirection === 'up') rotationZ = 90;
    if (incomingDirection === 'down') rotationZ = -90;
    if (incomingDirection === 'left') rotationZ = 180;
    return {
      isBend: false,
      rotationZ,
    };
  }

  return {
    isBend: true,
    rotationZ: resolvePipeBendRotation(incomingDirection, outgoingDirection),
  };
}

function resolveStepDirection(fromCoord: GridCoord, toCoord: GridCoord): PipeStepDirection {
  if (toCoord.row < fromCoord.row) {
    return 'up';
  }
  if (toCoord.row > fromCoord.row) {
    return 'down';
  }
  if (toCoord.col < fromCoord.col) {
    return 'left';
  }
  return 'right';
}

function isOppositePipeDirection(firstDirection: PipeStepDirection, secondDirection: PipeStepDirection): boolean {
  return (
    (firstDirection === 'up' && secondDirection === 'down')
    || (firstDirection === 'down' && secondDirection === 'up')
    || (firstDirection === 'left' && secondDirection === 'right')
    || (firstDirection === 'right' && secondDirection === 'left')
  );
}

function resolvePipeBendRotation(
  incomingDirection: PipeStepDirection,
  outgoingDirection: PipeStepDirection,
): number {
  const directionPairKey = `${incomingDirection}-${outgoingDirection}`;
  switch (directionPairKey) {
    case 'right-down':
    case 'down-right':
      return 0;
    case 'down-left':
    case 'left-down':
      return -90;
    case 'left-up':
    case 'up-left':
      return 180;
    case 'up-right':
    case 'right-up':
      return 90;
    default:
      return 0;
  }
}
