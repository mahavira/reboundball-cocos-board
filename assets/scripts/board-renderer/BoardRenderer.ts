import { Node } from 'cc';

import { BoardBallRenderer } from './BoardBallRenderer.ts';
import { BoardCoordinateMapper } from './BoardCoordinateMapper.ts';
import { BoardEntityLayerRenderer } from './BoardEntityLayerRenderer.ts';
import { BoardGridRenderer } from './BoardGridRenderer.ts';
import { BoardLayerRegistry } from './BoardLayerRegistry.ts';
import { BoardPipeRenderer } from './BoardPipeRenderer.ts';
import { BoardPlacementHighlightRenderer } from './BoardPlacementHighlightRenderer.ts';
import { BoardPredictionPathRenderer } from './BoardPredictionPathRenderer.ts';
import type { PlacementHighlightState } from './board-renderer-constants.ts';
import type {
  BallRenderState,
  EntityState,
  GridCoord,
  PredictionPathResult,
  UiPoint,
} from '../shared/types.ts';

/**
 * 棋盘渲染 facade，只负责组装子渲染器并转发外部调用。
 * 具体绘制、坐标转换、资源加载和节点集合维护都下沉到对应模块。
 */
export class BoardRenderer {
  private readonly layerRegistry: BoardLayerRegistry;
  private readonly coordinateMapper: BoardCoordinateMapper;
  private readonly gridRenderer: BoardGridRenderer;
  private readonly pipeRenderer: BoardPipeRenderer;
  private readonly entityLayerRenderer: BoardEntityLayerRenderer;
  private readonly ballRenderer: BoardBallRenderer;
  private readonly predictionPathRenderer: BoardPredictionPathRenderer;
  private readonly placementHighlightRenderer: BoardPlacementHighlightRenderer;

  constructor(rootNode: Node) {
    this.layerRegistry = new BoardLayerRegistry(rootNode);
    this.coordinateMapper = new BoardCoordinateMapper(() => this.layerRegistry.boardLayerNode);
    this.gridRenderer = new BoardGridRenderer({
      getGridLayerNode: () => this.layerRegistry.gridLayerNode,
      coordinateMapper: this.coordinateMapper,
    });
    this.pipeRenderer = new BoardPipeRenderer({
      getPipeLayerNode: () => this.layerRegistry.pipeLayerNode,
      coordinateMapper: this.coordinateMapper,
    });
    this.entityLayerRenderer = new BoardEntityLayerRenderer({
      getEntityLayerNode: () => this.layerRegistry.entityLayerNode,
      coordinateMapper: this.coordinateMapper,
    });
    this.ballRenderer = new BoardBallRenderer({
      getBallLayerNode: () => this.layerRegistry.ballLayerNode,
      coordinateMapper: this.coordinateMapper,
    });
    this.predictionPathRenderer = new BoardPredictionPathRenderer({
      getPredictionLayerNode: () => this.layerRegistry.predictionLayerNode,
      coordinateMapper: this.coordinateMapper,
    });
    this.placementHighlightRenderer = new BoardPlacementHighlightRenderer({
      getDragHighlightLayerNode: () => this.layerRegistry.dragHighlightLayerNode,
      coordinateMapper: this.coordinateMapper,
    });
  }

  /** 初始化渲染节点和静态棋盘，只需执行一次。 */
  initialize(): void {
    this.layerRegistry.initialize();
    this.gridRenderer.render();
    this.pipeRenderer.render();
  }

  rebuildEntityLayer(entities: EntityState[]): void {
    this.entityLayerRenderer.rebuild(entities);
  }

  updateEntityNode(coord: GridCoord, entity: EntityState | null): void {
    this.entityLayerRenderer.update(coord, entity);
  }

  playWeaponTailChargeFeedback(weaponCoord: GridCoord, tailCoord: GridCoord): void {
    this.entityLayerRenderer.playWeaponTailChargeFeedback(weaponCoord, tailCoord);
  }

  syncBallNodes(ballStates: BallRenderState[]): void {
    this.ballRenderer.syncBallNodes(ballStates);
  }

  syncIdleBallNodes(ballStates: BallRenderState[], activeBallIds: ReadonlySet<string>): void {
    this.ballRenderer.syncIdleBallNodes(ballStates, activeBallIds);
  }

  setBallPosition(ballId: string, coord: GridCoord): boolean {
    return this.ballRenderer.setBallPosition(ballId, coord);
  }

  rotateBall(ballId: string, rotationDeltaDegrees: number): boolean {
    return this.ballRenderer.rotateBall(ballId, rotationDeltaDegrees);
  }

  clearPredictionPath(): void {
    this.predictionPathRenderer.clear();
  }

  renderPredictionPath(prediction: PredictionPathResult): void {
    this.predictionPathRenderer.render(prediction);
  }

  resolveGridCoordFromUiPoint(uiPoint: UiPoint): GridCoord | null {
    return this.coordinateMapper.resolveGridCoordFromUiPoint(uiPoint);
  }

  showPlacementHighlight(coord: GridCoord, state: PlacementHighlightState): void {
    this.placementHighlightRenderer.show(coord, state);
  }

  clearPlacementHighlight(): void {
    this.placementHighlightRenderer.clear();
  }
}
