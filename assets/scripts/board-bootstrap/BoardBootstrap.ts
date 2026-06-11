import { _decorator, Component } from 'cc';

import { BallStepAnimator } from './BallStepAnimator.ts';
import { BoardDragBridge } from './BoardDragBridge.ts';
import { BoardPresentationRefresher } from './BoardPresentationRefresher.ts';
import { BoardRenderer } from '../board-renderer/BoardRenderer.ts';
import {
  BoardRuntime,
  createBoardPreset,
} from '../board-runtime/BoardRuntime.ts';
import type {
  BallProgressEvent,
  BoardDebugHost,
  BoardEntityChangeEvent,
  BoardShopHost,
} from '../shared/types.ts';

const { ccclass } = _decorator;

/**
 * 棋盘场景引导组件。
 *
 * 只负责把 runtime、renderer、弹球动画、展示刷新、拖拽交互装配起来。
 * 具体规则和交互细节下沉到独立协作者，避免场景组件继续膨胀。
 */
@ccclass('BoardBootstrap')
export class BoardBootstrap extends Component {
  private runtime!: BoardRuntime;
  private renderer!: BoardRenderer;
  private presentationRefresher!: BoardPresentationRefresher;
  private ballStepAnimator!: BallStepAnimator;
  private boardDragBridge!: BoardDragBridge;

  onLoad(): void {
    this.runtime = new BoardRuntime(createBoardPreset());

    this.renderer = new BoardRenderer(this.node);
    this.renderer.initialize();

    this.ballStepAnimator = new BallStepAnimator({
      runtime: this.runtime,
      renderer: this.renderer,
    });

    this.presentationRefresher = new BoardPresentationRefresher({
      runtime: this.runtime,
      renderer: this.renderer,
      getActiveBallIds: () => this.ballStepAnimator.getActiveBallIds(),
    });

    this.runtime.addEntityChangeListener((event) => this.handleEntityChange(event));

    this.boardDragBridge = new BoardDragBridge({
      rootNode: this.node,
      runtime: this.runtime,
      renderer: this.renderer,
    });
    this.boardDragBridge.bind();

    this.runtime.spawnBall({ ballId: 'ball-1', isFast: false });
    this.presentationRefresher.refreshBoardPresentation();
  }
  protected onDestroy(): void {
    this.boardDragBridge.unbind();
  }

  update(deltaTime: number): void {
    this.presentationRefresher.flushPendingPresentationRefreshes();
    this.ballStepAnimator.update(deltaTime * 1000);
  }

  /** 注册弹球进度监听器，返回取消注册函数。 */
  addBallProgressListener(listener: (event: BallProgressEvent) => void): () => void {
    return this.ballStepAnimator.addProgressListener(listener);
  }

  /** 以当前默认 preset 重置 runtime 与弹球，供调试桥和场景初始化复用。 */
  resetBoardRuntime(): void {
    this.ballStepAnimator.clear();
    this.runtime.resetBoard(createBoardPreset());
    this.runtime.spawnBall({ ballId: 'ball-1', isFast: false });
    this.presentationRefresher.flushPendingPresentationRefreshes();
    this.presentationRefresher.refreshIdleBallPresentation();
  }

  private handleEntityChange(event: BoardEntityChangeEvent): void {
    this.presentationRefresher.handleEntityChange(event);
  }

  /** 商店模块只拿到 host 契约，不直接依赖 runtime 或 renderer 实例。 */
  getShopHost(): BoardShopHost {
    return this.boardDragBridge.getShopHost();
  }

  /**
   * 调试模块通过显式 host 访问棋盘能力。
   * 这里保持在装配层做适配，避免调试组件反射读取 runtime/animator 私有字段。
   */
  getDebugHost(getNodeTreeText: () => string): BoardDebugHost {
    return {
      getState: () => this.runtime.getState(),
      getBalls: () => this.runtime.getBallStates(),
      getEntities: () => this.runtime.getEntities(),
      placeEntity: (spec) => {
        this.runtime.placeEntity(spec);
      },
      removeEntity: (coord) => {
        this.runtime.removeEntity(coord);
      },
      rotateEntity: (coord) => this.runtime.rotateEntity(coord),
      upgradeEntity: (coord) => this.runtime.upgradeEntity(coord),
      spawnBall: () => this.runtime.spawnBall({ isFast: false }),
      spawnFastBall: () => this.runtime.spawnBall({ isFast: true }),
      clearBalls: () => {
        this.ballStepAnimator.clear();
        this.runtime.clearBalls();
      },
      pause: () => {
        this.runtime.pause();
      },
      resume: () => {
        this.runtime.resume();
      },
      resetBoard: () => {
        this.resetBoardRuntime();
      },
      driveBallStepOnce: () => {
        for (const ball of this.runtime.getBallStates()) {
          this.ballStepAnimator.driveBallStepOnce(ball.ballId);
        }
      },
      isPaused: () => this.runtime.isPaused(),
      getNodeTreeText,
      onBallProgress: (listener) => this.addBallProgressListener(listener),
    };
  }
}
