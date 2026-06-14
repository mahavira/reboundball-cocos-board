import { cloneCoord } from '../shared/helpers.ts';
import { buildPipePath } from './board-runtime-rules.ts';
import { BOARD_SIZE } from './constants.ts';
import type {
  BallProgress,
  BallProgressEvent,
  BallRenderState,
  BallState,
  BallStepResult,
  BoardEntityChangeEvent,
  BoardPreset,
  Direction,
  EntitySpec,
  EntityState,
  GridCoord,
  MotionSegment,
  RuntimeState,
  SupportEntitySpec,
  SupportType,
  TurnerVariant,
  WeaponEntitySpec,
  WeaponEvent,
  WeaponModifiers,
  WeaponType,
} from '../shared/types.ts';
import { BallMotionBuilder } from './BallMotionBuilder.ts';
import { BallStepper } from './BallStepper.ts';
import { BoardRuntimeEvents } from './BoardRuntimeEvents.ts';
import { createPipeIndex } from './ball-path-rules.ts';
import type { EntityChangeKind } from './BoardRuntimeEvents.ts';
import { createBoardPreset } from './createBoardPreset.ts';
import { EntityMutations } from './EntityMutations.ts';
import { EntityStore } from './EntityStore.ts';
import { SupportAuraSystem } from './SupportAuraSystem.ts';
import { WeaponChargeSystem } from './WeaponChargeSystem.ts';

export { createBoardPreset } from './createBoardPreset.ts';

export type {
  BallProgress,
  BallProgressEvent,
  BallRenderState,
  BallState,
  BallStepResult,
  BoardPreset,
  BlockResult,
  CenterResult,
  Direction,
  EntitySpec,
  EntityState,
  GridCoord,
  MotionSegment,
  RuntimeState,
  SupportEntitySpec,
  SupportType,
  TurnerVariant,
  WeaponEntitySpec,
  WeaponEvent,
  WeaponModifiers,
  WeaponType,
} from '../shared/types.ts';

/**
 * 弹球棋盘运行时。
 *
 * 这个类只保留对外 API 和模块调度：
 * - 实体读写交给 EntityStore / EntityMutations
 * - 单步结算交给 BallStepper
 * - 武器充能交给 WeaponChargeSystem
 * - 动画段和进度事件交给 BallMotionBuilder
 */
export class BoardRuntime {
  private readonly entryCoord: GridCoord;
  private readonly baseStepMs: number;
  private readonly pipePath: GridCoord[];
  private readonly pipeIndexByKey: Map<string, number>;

  private readonly balls = new Map<string, BallState>();
  private readonly entities = new EntityStore();
  private readonly events = new BoardRuntimeEvents();
  private readonly entityMutations = new EntityMutations(this.entities, this.events);
  private readonly motionBuilder = new BallMotionBuilder();
  private readonly supportAuraSystem = new SupportAuraSystem(this.entities);
  private readonly weaponChargeSystem = new WeaponChargeSystem(
    this.entities,
    this.events,
    this.supportAuraSystem,
  );
  private readonly stepper: BallStepper;

  private stepIdSeed = 0;
  private ballIdSeed = 1;
  private paused = false;

  constructor(preset: BoardPreset) {
    this.entryCoord = cloneCoord(preset.entryCoord);
    this.baseStepMs = preset.baseStepMs;
    this.pipePath = buildPipePath(BOARD_SIZE, this.entryCoord);
    this.pipeIndexByKey = createPipeIndex(this.pipePath);

    this.entities.loadEntities(preset.entities);
    this.stepper = new BallStepper({
      balls: this.balls,
      entities: this.entities,
      events: this.events,
      weaponChargeSystem: this.weaponChargeSystem,
      motionBuilder: this.motionBuilder,
      entryCoord: this.entryCoord,
      baseStepMs: this.baseStepMs,
      pipePath: this.pipePath,
      pipeIndexByKey: this.pipeIndexByKey,
      nextStepId: () => this.nextStepId(),
    });
  }

  getState(): RuntimeState {
    return {
      entryCoord: cloneCoord(this.entryCoord),
      baseStepMs: this.baseStepMs,
      balls: this.getBallStates(),
    };
  }

  /** 返回入口坐标快照，避免外部直接修改内部状态。 */
  getEntryCoord(): GridCoord {
    return cloneCoord(this.entryCoord);
  }

  getPipePath(): GridCoord[] {
    return this.pipePath.map(cloneCoord);
  }

  getEntityAt(coord: GridCoord): EntityState | null {
    return this.entities.getSnapshot(coord);
  }

  getEntities(): EntityState[] {
    return this.entities.getAllSnapshots();
  }

  getBallStates(): BallRenderState[] {
    return Array.from(this.balls.values(), (ball) => this.toBallRenderState(ball));
  }

  isPaused(): boolean {
    return this.paused;
  }

  addEntityChangeListener(listener: (event: BoardEntityChangeEvent) => void): () => void {
    return this.events.addEntityChangeListener(listener);
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  spawnBall(options?: { ballId?: string; isFast?: boolean }): BallRenderState {
    const ball: BallState = {
      ballId: options?.ballId ?? this.createBallId(),
      cell: cloneCoord(this.entryCoord),
      direction: 'right',
      isFast: options?.isFast ?? false,
      speedMultiplier: 1,
    };

    this.balls.set(ball.ballId, ball);
    return this.toBallRenderState(ball);
  }

  clearBalls(): void {
    this.balls.clear();
  }

  /** 只重置实体布局和本轮弹球状态，入口与基础步进时长保持当前 runtime 配置。 */
  resetEntities(entities: EntitySpec[] = createBoardPreset().entities): void {
    this.entities.loadEntities(entities);
    this.clearBalls();
    this.paused = false;
    this.events.emitReset();
  }

  /**
   * 保留完整棋盘重置入口，但 preset 的棋盘级配置必须与当前 runtime 一致。
   * BoardRuntime 的入口和基础步进时长在构造后不会热替换，避免重置时出现半套 preset 生效。
   */
  resetBoard(preset: BoardPreset = createBoardPreset()): void {
    if (
      preset.baseStepMs !== this.baseStepMs
      || preset.entryCoord.row !== this.entryCoord.row
      || preset.entryCoord.col !== this.entryCoord.col
    ) {
      throw new Error('resetBoard cannot replace entryCoord or baseStepMs on an existing BoardRuntime');
    }

    this.resetEntities(preset.entities);
  }

  placeEntity(spec: EntitySpec, changeKind: EntityChangeKind = 'placed'): void {
    this.entityMutations.placeEntity(spec, changeKind);
  }

  removeEntity(coord: GridCoord): void {
    this.entityMutations.removeEntity(coord);
  }

  rotateEntity(coord: GridCoord): EntityState | null {
    return this.entityMutations.rotateEntity(coord);
  }

  upgradeEntity(coord: GridCoord): EntityState | null {
    return this.entityMutations.upgradeEntity(coord);
  }

  tickStep(): BallStepResult[] {
    if (this.paused) {
      return [];
    }

    return Array.from(this.balls.keys(), (ballId) => this.tickBall(ballId));
  }

  tickBall(ballId: string): BallStepResult {
    return this.stepper.tickBall(ballId);
  }

  private toBallRenderState(ball: BallState): BallRenderState {
    return {
      ballId: ball.ballId,
      cell: cloneCoord(ball.cell),
      direction: ball.direction,
      isFast: ball.isFast,
      speedMultiplier: ball.speedMultiplier,
    };
  }

  private createBallId(): string {
    return `ball-${++this.ballIdSeed}`;
  }

  private nextStepId(): number {
    return ++this.stepIdSeed;
  }
}
