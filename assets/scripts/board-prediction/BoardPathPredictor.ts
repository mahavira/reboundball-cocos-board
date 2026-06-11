import {
  buildPipePath,
  canEnterEntity,
  OPPOSITE_DIRECTION,
  resolveCenterInteraction,
  resolvePipeDirection,
} from '../board-runtime/board-runtime-rules.ts';
import { BOARD_SIZE } from '../board-runtime/constants.ts';
import {
  cloneCoord,
  coordKey,
  isBoardCoord,
  isOuterRingCoord,
  moveCoord,
  sameCoord,
} from '../shared/helpers.ts';
import type {
  BallState,
  EntityState,
  GridCoord,
  PredictionBoardSnapshot,
  PredictionPathOptions,
  PredictionPathResult,
  PredictionPathSegment,
} from '../shared/types.ts';

type PredictionState = Pick<BallState, 'cell' | 'direction' | 'isFast' | 'speedMultiplier'>;

type PredictionStepOutcome = {
  points: GridCoord[];
  segments: PredictionPathSegment[];
  terminationReason: PredictionPathResult['terminationReason'];
};

/**
 * 共享路径预测器只读取运行时快照，用本地状态模拟“若有一颗新球从入口重新出发”的轨迹。
 * 该模拟不会写回任何实体或弹球状态，因此只反映当前静态布局，而不复用真实运行时副作用。
 */
export class BoardPathPredictor {
  private readonly entryCoord: GridCoord;
  private readonly entityMap = new Map<string, EntityState>();
  private readonly pipePath = buildPipePath();
  private readonly pipeIndexByKey = new Map(this.pipePath.map((coord, index) => [coordKey(coord), index]));
  private readonly maxSteps: number;

  constructor(snapshot: PredictionBoardSnapshot, options?: PredictionPathOptions) {
    this.entryCoord = cloneCoord(snapshot.entryCoord);
    this.maxSteps = options?.maxSteps ?? 128;
    this.applySnapshot(snapshot);
  }

  /** 用最新快照更新内部实体映射，避免重建 Predictor 实例时的深拷贝开销。 */
  applySnapshot(snapshot: PredictionBoardSnapshot): void {
    this.entryCoord.row = snapshot.entryCoord.row;
    this.entryCoord.col = snapshot.entryCoord.col;
    this.entityMap.clear();
    snapshot.entities.forEach((entity) => {
      this.entityMap.set(coordKey(entity.coord), structuredClone(entity));
    });
  }

  /** 从入口开始预测当前共享球路径，直到命中终止条件。 */
  predictSharedPath(): PredictionPathResult {
    const predictionState: PredictionState = {
      cell: cloneCoord(this.entryCoord),
      direction: 'right',
      isFast: false,
      speedMultiplier: 1,
    };
    const visited = new Set<string>();
    const points: GridCoord[] = [cloneCoord(predictionState.cell)];
    const segments: PredictionPathSegment[] = [];

    for (let stepIndex = 0; stepIndex < this.maxSteps; stepIndex += 1) {
      const stateKey = `${predictionState.cell.row},${predictionState.cell.col}:${predictionState.direction}`;
      if (visited.has(stateKey)) {
        return {
          segments,
          points,
          terminationReason: 'looped',
          isEmpty: segments.length === 0,
        };
      }

      visited.add(stateKey);

      const outcome = this.predictNextStep(predictionState, stepIndex + 1);
      segments.push(...outcome.segments);
      points.push(...outcome.points);

      if (outcome.terminationReason) {
        return {
          segments,
          points,
          terminationReason: outcome.terminationReason,
          isEmpty: segments.length === 0,
        };
      }
    }

    return {
      segments,
      points,
      terminationReason: 'max-steps',
      isEmpty: segments.length === 0,
    };
  }

  private predictNextStep(state: PredictionState, stepId: number): PredictionStepOutcome {
    const currentCell = cloneCoord(state.cell);
    const currentDirection = state.direction;
    const currentEntity = this.getEntityAt(currentCell);
    const targetCell = this.resolveTargetCell(state);
    const targetEntity = this.getEntityAt(targetCell);

    if (!canEnterEntity(targetEntity, currentDirection)) {
      return this.handleBlockedStep(state, currentCell, currentDirection, currentEntity, stepId);
    }

    const movementSegment = this.createSegment(currentCell, targetCell, currentDirection);
    const points = [cloneCoord(targetCell)];

    state.cell = cloneCoord(targetCell);

    if (targetEntity?.kind === 'chaos-gate') {
      return {
        segments: [movementSegment],
        points,
        terminationReason: 'chaos-gate',
      };
    }

    const centerResult = resolveCenterInteraction(
      targetEntity,
      currentDirection,
      stepId,
      this.entryCoord,
    );
    if (centerResult.speedMultiplier !== undefined) {
      state.speedMultiplier = centerResult.speedMultiplier;
    }

    if (centerResult.teleportTo) {
      state.cell = cloneCoord(centerResult.teleportTo);
      state.direction = centerResult.resetDirection ?? 'right';
      return {
        segments: [
          movementSegment,
          this.createSegment(targetCell, centerResult.teleportTo, state.direction),
        ],
        points: [...points, cloneCoord(centerResult.teleportTo)],
        terminationReason: null,
      };
    }

    if (centerResult.nextDirection) {
      state.direction = centerResult.nextDirection;
    } else if (
      sameCoord(targetCell, this.entryCoord) &&
      isOuterRingCoord(targetCell, BOARD_SIZE) &&
      isOuterRingCoord(currentCell, BOARD_SIZE)
    ) {
      state.direction = 'right';
    } else if (
      isOuterRingCoord(targetCell, BOARD_SIZE) &&
      !sameCoord(targetCell, this.entryCoord)
    ) {
      state.direction = resolvePipeDirection(targetCell, this.pipePath, this.pipeIndexByKey);
    }

    return {
      segments: [movementSegment],
      points,
      terminationReason: null,
    };
  }

  private handleBlockedStep(
    state: PredictionState,
    currentCell: GridCoord,
    currentDirection: BallState['direction'],
    currentEntity: EntityState | null,
    stepId: number,
  ): PredictionStepOutcome {
    const reflectedDirection = OPPOSITE_DIRECTION[currentDirection];
    state.direction =
      (currentEntity?.kind === 'turner' || currentEntity?.kind === 'rotator')
        ? (resolveCenterInteraction(
            currentEntity,
            reflectedDirection,
            stepId,
            this.entryCoord,
          ).nextDirection ?? reflectedDirection)
        : reflectedDirection;

    // 预测结果按格级路径表达，阻挡时保留在当前格，下一步再按反射方向继续。
    return {
      segments: [this.createSegment(currentCell, currentCell, state.direction)],
      points: [cloneCoord(currentCell)],
      terminationReason: null,
    };
  }

  private createSegment(
    from: GridCoord,
    to: GridCoord,
    direction: BallState['direction'],
  ): PredictionPathSegment {
    return {
      from: cloneCoord(from),
      to: cloneCoord(to),
      direction,
      crossedCell: cloneCoord(from),
    };
  }

  private getEntityAt(coord: GridCoord): EntityState | null {
    return this.entityMap.get(coordKey(coord)) ?? null;
  }

  private resolveTargetCell(state: PredictionState): GridCoord {
    if (isOuterRingCoord(state.cell, BOARD_SIZE)) {
      if (sameCoord(state.cell, this.entryCoord) && state.direction === 'right') {
        return moveCoord(state.cell, 'right');
      }

      const currentIndex = this.pipeIndexByKey.get(coordKey(state.cell));
      if (currentIndex === undefined) {
        throw new Error(`Pipe cell missing index: ${coordKey(state.cell)}`);
      }

      return cloneCoord(this.pipePath[(currentIndex + 1) % this.pipePath.length]);
    }

    const nextCell = moveCoord(state.cell, state.direction);
    if (!isBoardCoord(nextCell, BOARD_SIZE)) {
      return state.cell;
    }

    return nextCell;
  }
}
