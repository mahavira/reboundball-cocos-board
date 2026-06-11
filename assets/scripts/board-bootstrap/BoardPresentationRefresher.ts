import { BoardPathPredictor } from '../board-prediction/BoardPathPredictor.ts';
import type { BoardRenderer } from '../board-renderer/BoardRenderer.ts';
import type { BoardRuntime } from '../board-runtime/BoardRuntime.ts';
import type { BoardEntityChangeEvent } from '../shared/types.ts';

interface BoardPresentationRefresherOptions {
  runtime: BoardRuntime;
  renderer: BoardRenderer;
  getActiveBallIds: () => Set<string>;
}

interface PendingPresentationRefresh {
  needsEntityRefresh: boolean;
  needsPredictionRefresh: boolean;
}

/**
 * 统一管理棋盘展示层刷新。
 *
 * runtime 可以在一次 tick 中多次发出实体变化；这里把刷新延迟到帧循环统一执行，
 * 避免实体层、预测路径和弹球节点在不同入口里交叉刷新。
 */
export class BoardPresentationRefresher {
  private readonly runtime: BoardRuntime;
  private readonly renderer: BoardRenderer;
  private readonly getActiveBallIds: () => Set<string>;
  private readonly pendingRefresh: PendingPresentationRefresh = {
    needsEntityRefresh: false,
    needsPredictionRefresh: false,
  };
  private predictionPathPredictor!: BoardPathPredictor;

  constructor(options: BoardPresentationRefresherOptions) {
    this.runtime = options.runtime;
    this.renderer = options.renderer;
    this.getActiveBallIds = options.getActiveBallIds;
  }

  handleEntityChange(event: BoardEntityChangeEvent): void {
    this.pendingRefresh.needsEntityRefresh = true;
    if (event.requiresPredictionRefresh) {
      this.pendingRefresh.needsPredictionRefresh = true;
    }
  }

  /** 把 runtime 发布的布局变化统一收口到帧循环里刷新。 */
  flushPendingPresentationRefreshes(): void {
    if (this.pendingRefresh.needsEntityRefresh) {
      this.refreshEntityPresentation();
    }

    if (this.pendingRefresh.needsPredictionRefresh) {
      this.refreshPredictionPresentation();
    }

    this.pendingRefresh.needsEntityRefresh = false;
    this.pendingRefresh.needsPredictionRefresh = false;
  }

  /**
   * 显式布局变更后统一刷新展示层。
   * 这里只重建与布局耦合的实体层、预测路径和空闲弹球位置。
   */
  refreshBoardPresentation(): void {
    this.refreshEntityPresentation();
    this.refreshPredictionPresentation();
    this.refreshIdleBallPresentation();
  }

  /** 只同步与空闲弹球位置相关的展示层，不重建实体和预测路径。 */
  refreshIdleBallPresentation(): void {
    this.ensureBallNodes();
    this.syncIdleBallNodes();
  }

  /** 用最新运行时实体快照重建实体层。 */
  private refreshEntityPresentation(): void {
    this.renderer.rebuildEntityLayer(this.runtime.getEntities());
  }

  /**
   * 用当前布局快照重建共享预测路径。
   * 预测只依赖入口与实体布局，不能复用真实弹球的运行时副作用。
   * 首次创建 Predictor 后复用实例，通过 applySnapshot 更新避免重复深拷贝全部实体。
   */
  private refreshPredictionPresentation(): void {
    const snapshot = {
      entryCoord: this.runtime.getEntryCoord(),
      entities: this.runtime.getEntities(),
    };

    if (!this.predictionPathPredictor) {
      this.predictionPathPredictor = new BoardPathPredictor(snapshot);
    } else {
      this.predictionPathPredictor.applySnapshot(snapshot);
    }

    this.renderer.renderPredictionPath(this.predictionPathPredictor.predictSharedPath());
  }

  /** 同步弹球渲染节点集合。 */
  private ensureBallNodes(): void {
    this.renderer.syncBallNodes(this.runtime.getBallStates());
  }

  /** 把所有未处于动画中的弹球同步回运行时位置。 */
  private syncIdleBallNodes(): void {
    this.renderer.syncIdleBallNodes(this.runtime.getBallStates(), this.getActiveBallIds());
  }
}
