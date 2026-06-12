import {
  cloneCoord,
  coordKey,
  isBoardCoord,
  isOuterRingCoord,
  moveCoord,
  sameCoord,
} from '../shared/helpers.ts';
import type { Direction, EntityState, GridCoord } from '../shared/types.ts';
import {
  OPPOSITE_DIRECTION,
  resolveCenterInteraction,
  resolvePipeDirection,
} from './board-runtime-rules.ts';

export type BallPathRuleContext = {
  entryCoord: GridCoord;
  boardSize: number;
  pipePath: readonly GridCoord[];
  pipeIndexByKey: ReadonlyMap<string, number>;
};

export type ResolveDirectionAfterCenterInput = BallPathRuleContext & {
  currentCell: GridCoord;
  targetCell: GridCoord;
  currentDirection: Direction;
  centerNextDirection?: Direction;
};

/** 运行时和预测共用的下一目标格规则：内区按方向走，外环沿管道走，越界停在原格。 */
export function resolveBallTargetCell(
  currentCell: GridCoord,
  direction: Direction,
  context: BallPathRuleContext,
): GridCoord {
  if (isOuterRingCoord(currentCell, context.boardSize)) {
    return resolveOuterRingTargetCell(currentCell, direction, context);
  }

  const nextCell = moveCoord(currentCell, direction);
  return isBoardCoord(nextCell, context.boardSize) ? nextCell : cloneCoord(currentCell);
}

/** 阻挡反弹方向规则。转向器/旋转器从反射方向重新结算一次中心转向。 */
export function resolveBlockedBallDirection(
  currentEntity: EntityState | null,
  currentDirection: Direction,
  stepId: number,
  entryCoord: GridCoord,
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
      entryCoord,
    ).nextDirection ?? reflectedDirection
  );
}

/** 中心结算后的方向规则。入口从管道回到内区时强制向右，其余外环格沿管道方向走。 */
export function resolveDirectionAfterCenter(input: ResolveDirectionAfterCenterInput): Direction {
  if (input.centerNextDirection) {
    return input.centerNextDirection;
  }

  if (shouldEnterBoardFromPipe(input.currentCell, input.targetCell, input)) {
    return 'right';
  }

  if (
    isOuterRingCoord(input.targetCell, input.boardSize)
    && !sameCoord(input.targetCell, input.entryCoord)
  ) {
    return resolvePipeDirection(input.targetCell, input.pipePath, input.pipeIndexByKey);
  }

  return input.currentDirection;
}

export function createPipeIndex(pipePath: readonly GridCoord[]): Map<string, number> {
  return new Map(pipePath.map((coord, index) => [coordKey(coord), index]));
}

export function shouldEnterBoardFromPipe(
  currentCell: GridCoord,
  targetCell: GridCoord,
  context: Pick<BallPathRuleContext, 'entryCoord' | 'boardSize'>,
): boolean {
  return (
    sameCoord(targetCell, context.entryCoord)
    && isOuterRingCoord(targetCell, context.boardSize)
    && isOuterRingCoord(currentCell, context.boardSize)
  );
}

function resolveOuterRingTargetCell(
  currentCell: GridCoord,
  direction: Direction,
  context: BallPathRuleContext,
): GridCoord {
  if (sameCoord(currentCell, context.entryCoord) && direction === 'right') {
    return moveCoord(currentCell, 'right');
  }

  const currentIndex = context.pipeIndexByKey.get(coordKey(currentCell));
  if (currentIndex === undefined) {
    throw new Error(`Pipe cell missing index: ${coordKey(currentCell)}`);
  }

  return cloneCoord(context.pipePath[(currentIndex + 1) % context.pipePath.length]);
}
