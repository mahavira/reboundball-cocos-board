import {
  cloneCoord,
  coordKey,
  isBoardCoord,
  isOuterRingCoord,
  moveCoord,
  sameCoord,
} from '../shared/helpers.ts';
import {
  canEnterEntity,
  getSegmentDurationMs,
  handleBlockedEntityHit,
  OPPOSITE_DIRECTION,
  resolveCenterInteraction,
  resolvePipeDirection,
  resolveSegmentDurationMultiplier,
  rotateVariantClockwise,
} from './board-runtime-rules.ts';
import type {
  BallProgressEvent,
  BallState,
  BallStepResult,
  Direction,
  EntityState,
  GridCoord,
  MotionSegment,
  WeaponEvent,
} from '../shared/types.ts';
import { BOARD_SIZE } from './constants.ts';
import { BallMotionBuilder } from './BallMotionBuilder.ts';
import { BoardRuntimeEvents } from './BoardRuntimeEvents.ts';
import { EntityStore } from './EntityStore.ts';
import { WeaponChargeSystem } from './WeaponChargeSystem.ts';

type StepContext = {
  ball: BallState;
  ballId: string;
  stepId: number;
  currentCell: GridCoord;
  currentDirection: Direction;
  currentEntity: EntityState | null;
  targetCell: GridCoord;
  targetEntity: EntityState | null;
  incomingDirection: Direction;
  currentDurationMultiplier: number;
  weaponEvents: WeaponEvent[];
};

type BallStepperDeps = {
  balls: Map<string, BallState>;
  entities: EntityStore;
  events: BoardRuntimeEvents;
  weaponChargeSystem: WeaponChargeSystem;
  motionBuilder: BallMotionBuilder;
  entryCoord: GridCoord;
  baseStepMs: number;
  pipePath: GridCoord[];
  pipeIndexByKey: Map<string, number>;
  nextStepId: () => number;
};

/** 单颗弹球的一步结算：目标格、阻挡、移动、中心交互。 */
export class BallStepper {
  private readonly balls: Map<string, BallState>;
  private readonly entities: EntityStore;
  private readonly events: BoardRuntimeEvents;
  private readonly weaponChargeSystem: WeaponChargeSystem;
  private readonly motionBuilder: BallMotionBuilder;
  private readonly entryCoord: GridCoord;
  private readonly baseStepMs: number;
  private readonly pipePath: GridCoord[];
  private readonly pipeIndexByKey: Map<string, number>;
  private readonly nextStepId: () => number;

  constructor(deps: BallStepperDeps) {
    this.balls = deps.balls;
    this.entities = deps.entities;
    this.events = deps.events;
    this.weaponChargeSystem = deps.weaponChargeSystem;
    this.motionBuilder = deps.motionBuilder;
    this.entryCoord = deps.entryCoord;
    this.baseStepMs = deps.baseStepMs;
    this.pipePath = deps.pipePath;
    this.pipeIndexByKey = deps.pipeIndexByKey;
    this.nextStepId = deps.nextStepId;
  }

  tickBall(ballId: string): BallStepResult {
    const context = this.createStepContext(ballId);

    if (!canEnterEntity(context.targetEntity, context.incomingDirection)) {
      return this.createBlockedStepResult(context);
    }

    return this.createMovedStepResult(context);
  }

  private createStepContext(ballId: string): StepContext {
    const ball = this.balls.get(ballId);
    if (!ball) {
      throw new Error(`Ball not found: ${ballId}`);
    }

    const stepId = this.nextStepId();
    const currentCell = cloneCoord(ball.cell);
    const currentDirection = ball.direction;
    const currentEntity = this.entities.getMutable(currentCell);
    const weaponEvents = this.weaponChargeSystem.handleTailCharge(currentCell);
    const targetCell = this.resolveTargetCell(ball);
    const targetEntity = this.entities.getMutable(targetCell);
    const incomingDirection = ball.direction;
    const currentDurationMultiplier = resolveSegmentDurationMultiplier({
      ball,
      fromCell: currentCell,
      toCell: targetCell,
      currentEntity,
      targetEntity,
      entryCoord: this.entryCoord,
      boardSize: BOARD_SIZE,
      phase: 'from-current',
    });

    return {
      ball,
      ballId,
      stepId,
      currentCell,
      currentDirection,
      currentEntity,
      targetCell,
      targetEntity,
      incomingDirection,
      currentDurationMultiplier,
      weaponEvents,
    };
  }

  private resolveTargetCell(ball: BallState): GridCoord {
    if (isOuterRingCoord(ball.cell, BOARD_SIZE)) {
      return this.resolveOuterRingTarget(ball);
    }

    const next = moveCoord(ball.cell, ball.direction);
    return isBoardCoord(next, BOARD_SIZE) ? next : ball.cell;
  }

  private resolveOuterRingTarget(ball: BallState): GridCoord {
    if (sameCoord(ball.cell, this.entryCoord) && ball.direction === 'right') {
      return moveCoord(ball.cell, 'right');
    }

    const currentIndex = this.pipeIndexByKey.get(coordKey(ball.cell));
    if (currentIndex === undefined) {
      throw new Error(`Pipe cell missing index: ${coordKey(ball.cell)}`);
    }

    return cloneCoord(this.pipePath[(currentIndex + 1) % this.pipePath.length]);
  }

  private createBlockedStepResult(context: StepContext): BallStepResult {
    const {
      ball,
      ballId,
      stepId,
      currentCell,
      currentDirection,
      currentEntity,
      targetCell,
      targetEntity,
      currentDurationMultiplier,
      weaponEvents,
    } = context;

    this.resolveBlockedEntityState(targetCell, targetEntity);

    ball.direction = this.resolveBlockedDirection(currentEntity, ball.direction, stepId);

    const segmentDurationMs = getSegmentDurationMs(
      this.baseStepMs,
      ball,
      currentDurationMultiplier,
    );

    return {
      ballId,
      stepId,
      outcome: 'blocked',
      finalCell: cloneCoord(ball.cell),
      finalDirection: ball.direction,
      segments: this.motionBuilder.createStepSegments(
        currentCell,
        currentDirection,
        currentCell,
        segmentDurationMs,
        segmentDurationMs,
      ),
      progressEvents: [],
      weaponEvents,
    };
  }

  private createMovedStepResult(context: StepContext): BallStepResult {
    const {
      ball,
      ballId,
      stepId,
      currentCell,
      currentDirection,
      currentEntity,
      targetCell,
      targetEntity,
      incomingDirection,
      currentDurationMultiplier,
      weaponEvents,
    } = context;

    const firstSegmentDurationMs = getSegmentDurationMs(
      this.baseStepMs,
      ball,
      currentDurationMultiplier,
    );
    const secondSegmentDurationMs = this.resolveTargetSegmentDuration(context);
    const segments = this.motionBuilder.createStepSegments(
      currentCell,
      currentDirection,
      targetCell,
      firstSegmentDurationMs,
      secondSegmentDurationMs,
    );
    const progressEvents = this.motionBuilder.createMoveProgressEvents(
      ball,
      currentCell,
      currentDirection,
      targetCell,
      incomingDirection,
      stepId,
      firstSegmentDurationMs,
    );

    this.rotateCurrentRotatorIfNeeded(currentCell, currentEntity);

    ball.cell = cloneCoord(targetCell);
    progressEvents.push(
      this.motionBuilder.createProgressEvent(
        ball,
        targetCell,
        ball.direction,
        stepId,
        50,
        firstSegmentDurationMs + secondSegmentDurationMs,
      ),
    );

    const centerResult = resolveCenterInteraction(
      targetEntity,
      ball.direction,
      stepId,
      this.entryCoord,
    );

    if (centerResult.speedMultiplier !== undefined) {
      ball.speedMultiplier = centerResult.speedMultiplier;
    }

    if (centerResult.teleportTo) {
      ball.cell = cloneCoord(centerResult.teleportTo);
      ball.direction = centerResult.resetDirection ?? 'right';

      return this.createStepResult({
        ball,
        ballId,
        stepId,
        outcome: 'teleported',
        segments,
        progressEvents,
        weaponEvents,
      });
    }

    ball.direction = this.resolveDirectionAfterCenterInteraction(
      currentCell,
      targetCell,
      ball.direction,
      centerResult.nextDirection,
    );

    return this.createStepResult({
      ball,
      ballId,
      stepId,
      outcome: 'moved',
      segments,
      progressEvents,
      weaponEvents,
    });
  }

  private resolveTargetSegmentDuration(context: StepContext): number {
    const {
      ball,
      currentCell,
      currentEntity,
      targetCell,
      targetEntity,
    } = context;

    const targetDurationMultiplier = resolveSegmentDurationMultiplier({
      ball,
      fromCell: currentCell,
      toCell: targetCell,
      currentEntity,
      targetEntity,
      entryCoord: this.entryCoord,
      boardSize: BOARD_SIZE,
      phase: 'to-target',
    });

    return getSegmentDurationMs(this.baseStepMs, ball, targetDurationMultiplier);
  }

  private resolveBlockedEntityState(targetCell: GridCoord, targetEntity: EntityState | null): void {
    const blockResult = handleBlockedEntityHit(targetEntity);

    if (blockResult.removeSelf) {
      this.entities.delete(targetCell);
      this.events.emitCoordChange('removed', targetCell, true);
      return;
    }

    if (targetEntity?.kind === 'ice-block') {
      this.events.emitCoordChange('state-changed', targetCell, true);
    }
  }

  private rotateCurrentRotatorIfNeeded(
    currentCell: GridCoord,
    currentEntity: EntityState | null,
  ): void {
    if (currentEntity?.kind !== 'rotator') {
      return;
    }

    currentEntity.variant = rotateVariantClockwise(currentEntity.variant);
    this.events.emitCoordChange('rotated', currentCell, true);
  }

  private resolveBlockedDirection(
    currentEntity: EntityState | null,
    currentDirection: Direction,
    stepId: number,
  ): Direction {
    const reflectedDirection = OPPOSITE_DIRECTION[currentDirection];

    if (!currentEntity || !('variant' in currentEntity)) {
      return reflectedDirection;
    }

    return (
      resolveCenterInteraction(
        currentEntity,
        reflectedDirection,
        stepId,
        this.entryCoord,
      ).nextDirection ?? reflectedDirection
    );
  }

  private resolveDirectionAfterCenterInteraction(
    currentCell: GridCoord,
    targetCell: GridCoord,
    currentDirection: Direction,
    centerNextDirection?: Direction,
  ): Direction {
    if (centerNextDirection) {
      return centerNextDirection;
    }

    if (this.shouldEnterBoardFromPipe(currentCell, targetCell)) {
      return 'right';
    }

    if (isOuterRingCoord(targetCell, BOARD_SIZE) && !sameCoord(targetCell, this.entryCoord)) {
      return resolvePipeDirection(targetCell, this.pipePath, this.pipeIndexByKey);
    }

    return currentDirection;
  }

  private shouldEnterBoardFromPipe(currentCell: GridCoord, targetCell: GridCoord): boolean {
    return (
      sameCoord(targetCell, this.entryCoord) &&
      isOuterRingCoord(targetCell, BOARD_SIZE) &&
      isOuterRingCoord(currentCell, BOARD_SIZE)
    );
  }

  private createStepResult(params: {
    ball: BallState;
    ballId: string;
    stepId: number;
    outcome: BallStepResult['outcome'];
    segments: MotionSegment[];
    progressEvents: BallProgressEvent[];
    weaponEvents: WeaponEvent[];
  }): BallStepResult {
    const {
      ball,
      ballId,
      stepId,
      outcome,
      segments,
      progressEvents,
      weaponEvents,
    } = params;

    return {
      ballId,
      stepId,
      outcome,
      finalCell: cloneCoord(ball.cell),
      finalDirection: ball.direction,
      segments,
      progressEvents,
      weaponEvents,
    };
  }
}
