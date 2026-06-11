import { cloneCoord, coordKey } from '../shared/helpers.ts';
import { buildPipePath } from './board-runtime-rules.ts';
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
  TurnerVariant,
  WeaponEntitySpec,
  WeaponEvent,
  WeaponType,
} from '../shared/types.ts';
import { BallMotionBuilder } from './BallMotionBuilder.ts';
import { BallStepper } from './BallStepper.ts';
import { BoardRuntimeEvents } from './BoardRuntimeEvents.ts';
import type { EntityChangeKind } from './BoardRuntimeEvents.ts';
import { createBoardPreset } from './createBoardPreset.ts';
import { EntityMutations } from './EntityMutations.ts';
import { EntityStore } from './EntityStore.ts';
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
  TurnerVariant,
  WeaponEntitySpec,
  WeaponEvent,
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
  private readonly weaponChargeSystem = new WeaponChargeSystem(this.entities, this.events);
  private readonly stepper: BallStepper;

  private stepIdSeed = 0;
  private ballIdSeed = 1;
  private paused = false;

  constructor(preset: BoardPreset) {
    this.entryCoord = cloneCoord(preset.entryCoord);
    this.baseStepMs = preset.baseStepMs;
    this.pipePath = buildPipePath();
    this.pipeIndexByKey = this.createPipeIndex(this.pipePath);

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

  resetBoard(preset: BoardPreset = createBoardPreset()): void {
    this.entities.loadEntities(preset.entities);
    this.clearBalls();
    this.paused = false;
    this.events.emitReset();
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

  private createPipeIndex(pipePath: GridCoord[]): Map<string, number> {
    return new Map(pipePath.map((coord, index) => [coordKey(coord), index]));
  }

  private createBallId(): string {
    return `ball-${++this.ballIdSeed}`;
  }

  private nextStepId(): number {
    return ++this.stepIdSeed;
  }
}
