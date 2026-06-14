import {
  collectReachedProgressEvents,
  createStepContext,
  shouldStartBallStep,
} from './board-bootstrap-step-driver.ts';
import { BALL_ROLL_DEGREES_PER_SECOND } from './board-animation-config.ts';
import { cloneCoord } from '../shared/helpers.ts';
import type { BoardRenderer } from '../board-renderer/BoardRenderer.ts';
import type { BoardRuntime } from '../board-runtime/BoardRuntime.ts';
import type {
  BallProgressEvent,
  BallStepContext,
  BallStepResult,
  GridCoord,
} from '../shared/types.ts';

interface BallStepAnimatorOptions {
  runtime: BoardRuntime;
  renderer: BoardRenderer;
  ballRollDegreesPerSecond?: number;
}

/**
 * 负责把 runtime 的离散 step 结果播放成逐帧动画。
 *
 * 这里不处理实体规则、不处理拖拽、不重建棋盘展示层。
 */
export class BallStepAnimator {
  private readonly runtime: BoardRuntime;
  private readonly renderer: BoardRenderer;
  private readonly ballRollDegreesPerSecond: number;
  /** ballId → 当前正在推进的 step 上下文。 */
  private readonly activeBallSteps = new Map<string, BallStepContext>();
  private readonly activeBallIdsSnapshot = new Set<string>();
  /** 弹球进度事件的外部监听器集合。 */
  private readonly progressListeners = new Set<(event: BallProgressEvent) => void>();

  constructor(options: BallStepAnimatorOptions) {
    this.runtime = options.runtime;
    this.renderer = options.renderer;
    this.ballRollDegreesPerSecond = options.ballRollDegreesPerSecond ?? BALL_ROLL_DEGREES_PER_SECOND;
  }

  update(deltaMs: number): void {
    const ballStates = this.runtime.getBallStates();
    this.renderer.syncBallNodes(ballStates);

    // 暂停且没有正在播放的 step 动画时，跳过逐球驱动循环以减少每帧开销
    if (this.runtime.isPaused() && this.activeBallSteps.size === 0) {
      return;
    }

    for (const ball of ballStates) {
      this.driveBallStep(ball.ballId, deltaMs);
    }
  }

  clear(): void {
    this.activeBallSteps.clear();
    this.activeBallIdsSnapshot.clear();
  }

  getActiveBallIds(): Set<string> {
    this.activeBallIdsSnapshot.clear();
    for (const ballId of this.activeBallSteps.keys()) {
      this.activeBallIdsSnapshot.add(ballId);
    }
    return this.activeBallIdsSnapshot;
  }

  addProgressListener(listener: (event: BallProgressEvent) => void): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  /** 调试入口：为指定弹球强制领取下一 step，不暴露内部 active step 结构。 */
  driveBallStepOnce(ballId: string): void {
    this.startBallStep(ballId, true);
  }

  /**
   * 统一驱动单颗弹球的 step 生命周期。
   * 同一帧内会持续消费 deltaMs，必要时把溢出的时间结转到后续 step。
   */
  private driveBallStep(ballId: string, deltaMs: number): void {
    let remainingMs = deltaMs;

    while (remainingMs >= 0) {
      if (!this.activeBallSteps.has(ballId)) {
        this.startBallStep(ballId);
        if (!this.activeBallSteps.has(ballId)) {
          return;
        }
      }

      const overflowMs = this.advanceBallStep(ballId, remainingMs);
      if (overflowMs <= 0) {
        return;
      }

      if (this.activeBallSteps.has(ballId)) {
        return;
      }

      remainingMs = overflowMs;
    }
  }

  /**
   * 为单颗空闲弹球领取下一 step。
   * force=true 时忽略暂停状态，允许外部强制推进一步。
   */
  private startBallStep(ballId: string, force = false): void {
    if (!shouldStartBallStep({
      isPaused: this.runtime.isPaused(),
      force,
      hasActiveStep: this.activeBallSteps.has(ballId),
    })) {
      return;
    }

    const step = this.runtime.tickBall(ballId);
    this.activeBallSteps.set(ballId, createStepContext(step));
  }

  /** 推进单颗弹球当前 step，并在到达阶段点时派发进度事件。 */
  private advanceBallStep(ballId: string, deltaMs: number): number {
    const stepContext = this.activeBallSteps.get(ballId);
    if (!stepContext) {
      return 0;
    }

    stepContext.elapsedMs += deltaMs;
    const clampedElapsedMs = Math.min(stepContext.elapsedMs, stepContext.totalDurationMs);
    const overflowMs = Math.max(stepContext.elapsedMs - stepContext.totalDurationMs, 0);
    const consumedMs = Math.max(deltaMs - overflowMs, 0);
    const currentCoord = this.resolveAnimationCoord(stepContext.step, clampedElapsedMs);

    if (!this.renderer.setBallPosition(ballId, currentCoord)) {
      this.activeBallSteps.delete(ballId);
      return 0;
    }
    this.renderer.rotateBall(ballId, this.toRotationDeltaDegrees(consumedMs));

    this.emitReachedProgressEvents(stepContext, clampedElapsedMs);

    if (clampedElapsedMs >= stepContext.totalDurationMs) {
      this.finishBallStep(ballId, stepContext);
      return overflowMs;
    }

    return 0;
  }

  private emitReachedProgressEvents(
    stepContext: BallStepContext,
    clampedElapsedMs: number,
  ): void {
    const reachedEvents = collectReachedProgressEvents(stepContext, clampedElapsedMs);
    for (const event of reachedEvents) {
      this.progressListeners.forEach((listener) => listener(event));
    }
  }

  /** 动画结束时把弹球节点对齐到最终格子，并清理动画状态。 */
  private finishBallStep(ballId: string, stepContext: BallStepContext): void {
    this.renderer.setBallPosition(ballId, stepContext.step.finalCell);
    this.activeBallSteps.delete(ballId);
  }

  /** 根据 step 轨迹和已流逝时长计算当前插值坐标。 */
  private resolveAnimationCoord(step: BallStepResult, elapsedMs: number): GridCoord {
    let remainingMs = elapsedMs;
    for (const segment of step.segments) {
      if (remainingMs > segment.durationMs) {
        remainingMs -= segment.durationMs;
        continue;
      }
      const progress = segment.durationMs <= 0 ? 1 : remainingMs / segment.durationMs;
      return {
        row: segment.from.row + (segment.to.row - segment.from.row) * progress,
        col: segment.from.col + (segment.to.col - segment.from.col) * progress,
      };
    }
    return cloneCoord(step.finalCell);
  }

  private toRotationDeltaDegrees(deltaMs: number): number {
    return (deltaMs / 1000) * this.ballRollDegreesPerSecond;
  }
}
