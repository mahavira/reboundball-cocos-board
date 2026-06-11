import { cloneCoord, getBoundaryCoord } from '../shared/helpers.ts';
import type {
  BallProgress,
  BallProgressEvent,
  BallState,
  Direction,
  GridCoord,
  MotionSegment,
} from '../shared/types.ts';

/** 只负责构造动画段和进度事件，不参与规则判断。 */
export class BallMotionBuilder {
  createStepSegments(
    currentCell: GridCoord,
    currentDirection: Direction,
    targetCell: GridCoord,
    firstSegmentDurationMs: number,
    secondSegmentDurationMs: number,
  ): MotionSegment[] {
    const boundaryCoord = getBoundaryCoord(currentCell, currentDirection);

    return [
      {
        from: currentCell,
        to: boundaryCoord,
        durationMs: firstSegmentDurationMs,
      },
      {
        from: boundaryCoord,
        to: targetCell,
        durationMs: secondSegmentDurationMs,
      },
    ];
  }

  createMoveProgressEvents(
    ball: BallState,
    currentCell: GridCoord,
    currentDirection: Direction,
    targetCell: GridCoord,
    incomingDirection: Direction,
    stepId: number,
    firstSegmentDurationMs: number,
  ): BallProgressEvent[] {
    return [
      this.createProgressEvent(
        ball,
        currentCell,
        currentDirection,
        stepId,
        100,
        firstSegmentDurationMs,
      ),
      this.createProgressEvent(
        ball,
        targetCell,
        incomingDirection,
        stepId,
        0,
        firstSegmentDurationMs,
      ),
    ];
  }

  createProgressEvent(
    ball: BallState,
    cell: GridCoord,
    direction: Direction,
    stepId: number,
    progress: BallProgress,
    atMs: number,
  ): BallProgressEvent {
    return {
      ballId: ball.ballId,
      cell: cloneCoord(cell),
      direction,
      stepId,
      progress,
      atMs,
    };
  }
}
