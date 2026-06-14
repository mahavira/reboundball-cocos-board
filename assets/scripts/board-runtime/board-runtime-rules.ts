import { cloneCoord, coordKey, isOuterRingCoord, moveCoord, sameCoord } from '../shared/helpers.ts';
import {
  CLOCKWISE_DIRECTION_BY_DIRECTION,
  CLOCKWISE_VARIANT_BY_VARIANT,
  DIRECTIONS,
  LEVEL_SPEED_MULTIPLIERS,
  OPPOSITE_DIRECTION,
  TURNER_EXIT_DIRECTION_BY_VARIANT,
  WEAPON_CHARGE_LIMITS,
} from '../shared/entity-definitions.ts';
import type {
  BallState,
  BlockResult,
  CenterInteractionResult,
  Direction,
  EntitySpec,
  EntityState,
  GridCoord,
  SegmentDurationInput,
  TurnerVariant,
  WeaponEntitySpec,
} from '../shared/types.ts';

export {
  LEVEL_SPEED_MULTIPLIERS,
  OPPOSITE_DIRECTION,
  WEAPON_CHARGE_LIMITS,
};

/** 顺时针旋转转向器变体。 */
export function rotateVariantClockwise(variant: TurnerVariant): TurnerVariant {
  return CLOCKWISE_VARIANT_BY_VARIANT[variant];
}

/**
 * 根据转向器变体和弹球当前运动方向，计算通过后的离开方向。
 * `variant` 描述的是「进入边-离开边」，所以需要先把运动方向换算成进入边。
 */
export function getTurnerExitDirection(
  variant: TurnerVariant,
  travelDirection: Direction,
): Direction | null {
  const entrySide = OPPOSITE_DIRECTION[travelDirection];
  return TURNER_EXIT_DIRECTION_BY_VARIANT[variant][entrySide] ?? null;
}

/** 获取武器尾部方向列表。 */
export function getWeaponTailDirections(spec: WeaponEntitySpec): Direction[] {
  if (spec.tailDirections && spec.tailDirections.length > 0) {
    return [...spec.tailDirections];
  }
  return [spec.facing];
}

/** 将实体放置规格转换为运行时状态。 */
export function createEntityState(spec: EntitySpec, entityId: string): EntityState {
  switch (spec.kind) {
    case 'turner':
      return {
        kind: 'turner',
        coord: cloneCoord(spec.coord),
        variant: spec.variant,
        level: spec.level,
      };
    case 'rotator':
      return {
        kind: 'rotator',
        coord: cloneCoord(spec.coord),
        variant: spec.variant,
        level: spec.level,
      };
    case 'slow-zone':
      return {
        kind: 'slow-zone',
        coord: cloneCoord(spec.coord),
      };
    case 'chaos-gate':
      return {
        kind: 'chaos-gate',
        coord: cloneCoord(spec.coord),
      };
    case 'black-hole':
      return {
        kind: 'black-hole',
        coord: cloneCoord(spec.coord),
      };
    case 'wreckage':
      return {
        kind: 'wreckage',
        coord: cloneCoord(spec.coord),
      };
    case 'ice-block':
      return {
        kind: 'ice-block',
        coord: cloneCoord(spec.coord),
        durability: spec.durability ?? 10,
      };
    case 'stone':
      return {
        kind: 'stone',
        coord: cloneCoord(spec.coord),
      };
    case 'weapon':
      return {
        kind: 'weapon',
        id: entityId,
        coord: cloneCoord(spec.coord),
        weaponType: spec.weaponType,
        level: spec.level ?? 1,
        facing: spec.facing,
        tailDirections: getWeaponTailDirections(spec),
        charge: spec.charge ?? 0,
      };
    case 'support':
      return {
        kind: 'support',
        coord: cloneCoord(spec.coord),
        supportType: spec.supportType,
        level: spec.level ?? 1,
      };
    default:
      return assertNever(spec);
  }
}

/** 计算单段运动的持续时间（毫秒）。保留浮点精度以避免 Math.round 在多次调用间造成累积漂移。 */
export function getSegmentDurationMs(
  baseStepMs: number,
  ball: BallState,
  terrainDurationMultiplier: number,
): number {
  const fastFactor = ball.isFast ? 0.5 : 1;
  return (baseStepMs / 2) * terrainDurationMultiplier * fastFactor / ball.speedMultiplier;
}

/** 获取武器实体尾部占据的格子坐标列表。 */
export function getWeaponTailCells(entity: EntityState): GridCoord[] {
  if (entity.kind !== 'weapon') {
    return [];
  }

  return entity.tailDirections.map((direction) => moveCoord(entity.coord, direction));
}

export function getWeaponChargeLimit(entity: Extract<EntityState, { kind: 'weapon' }>): number {
  return WEAPON_CHARGE_LIMITS[entity.weaponType];
}

/** 混沌门的方向偏转逻辑。 */
export function nextChaosDirection(direction: Direction, stepId: number): Direction {
  const currentIndex = DIRECTIONS.indexOf(direction);
  return DIRECTIONS[(currentIndex + stepId + 1) % DIRECTIONS.length];
}

export function rotateFacingClockwise(direction: Direction): Direction {
  return CLOCKWISE_DIRECTION_BY_DIRECTION[direction];
}

/** 构建外环管道路径，供运行时初始化时一次性缓存。 */
export function buildPipePath(boardSize: number, entryCoord: GridCoord): GridCoord[] {
  const path: GridCoord[] = [];
  const maxIndex = boardSize - 1;
  const topRow = 0;
  const leftCol = 0;
  const rightCol = maxIndex;
  const bottomRow = maxIndex;

  for (let row = entryCoord.row; row <= bottomRow; row += 1) {
    path.push({ row, col: leftCol });
  }
  for (let col = leftCol + 1; col <= rightCol; col += 1) {
    path.push({ row: bottomRow, col });
  }
  for (let row = bottomRow - 1; row >= topRow; row -= 1) {
    path.push({ row, col: rightCol });
  }
  for (let col = rightCol - 1; col >= leftCol; col -= 1) {
    path.push({ row: topRow, col });
  }
  for (let row = topRow + 1; row < entryCoord.row; row += 1) {
    path.push({ row, col: leftCol });
  }

  return path;
}

/** 根据外环路径中下一个格子，推算弹球在管道中的朝向。 */
export function resolvePipeDirection(
  coord: GridCoord,
  pipePath: GridCoord[],
  pipeIndexByKey: ReadonlyMap<string, number>,
): Direction {
  const index = pipeIndexByKey.get(coordKey(coord));
  if (index === undefined) {
    return 'right';
  }
  const nextCoord = pipePath[(index + 1) % pipePath.length];
  if (nextCoord.row > coord.row) {
    return 'down';
  }
  if (nextCoord.row < coord.row) {
    return 'up';
  }
  if (nextCoord.col > coord.col) {
    return 'right';
  }
  return 'left';
}

/** 转向器/旋转器需要入口方向匹配，其余阻挡物不可进入。 */
export function canEnterEntity(entity: EntityState | null, incomingDirection: Direction): boolean {
  if (!entity) {
    return true;
  }

  switch (entity.kind) {
    case 'turner':
    case 'rotator':
      return getTurnerExitDirection(entity.variant, incomingDirection) !== null;
    case 'ice-block':
    case 'stone':
    case 'weapon':
    case 'support':
      return false;
    case 'slow-zone':
    case 'chaos-gate':
    case 'black-hole':
    case 'wreckage':
      return true;
  }
}

/** 处理阻挡型实体被撞击后的耐久消耗与移除判定。 */
export function handleBlockedEntityHit(entity: EntityState | null): BlockResult {
  if (!entity) {
    return {};
  }

  if (entity.kind === 'ice-block') {
    entity.durability -= 1;
    return { removeSelf: entity.durability <= 0 };
  }

  return {};
}

/** 结算目标格中心的规则效果，不直接依赖运行时实例。 */
export function resolveCenterInteraction(
  entity: EntityState | null,
  direction: Direction,
  stepId: number,
  entryCoord: GridCoord,
): CenterInteractionResult {
  if (!entity) {
    return {};
  }

  switch (entity.kind) {
    case 'turner':
    case 'rotator':
      return {
        nextDirection: getTurnerExitDirection(entity.variant, direction) ?? undefined,
        speedMultiplier: LEVEL_SPEED_MULTIPLIERS[entity.level] ?? 1,
      };
    case 'chaos-gate':
      return {
        nextDirection: nextChaosDirection(direction, stepId),
      };
    case 'black-hole':
      return {
        teleportTo: cloneCoord(entryCoord),
        resetDirection: 'right',
        speedMultiplier: 1,
      };
    case 'slow-zone':
    case 'wreckage':
    case 'ice-block':
    case 'stone':
    case 'weapon':
    case 'support':
      return {};
  }
}

/** 统一计算单段地形/管道时长倍率，速度倍率在 getSegmentDurationMs 中单独换算。 */
export function resolveSegmentDurationMultiplier(input: SegmentDurationInput): number {
  const innerEntryCell = moveCoord(input.entryCoord, 'right');

  if (input.phase === 'from-current') {
    if (
      sameCoord(input.fromCell, input.entryCoord) &&
      sameCoord(input.toCell, innerEntryCell)
    ) {
      return input.ball.speedMultiplier;
    }

    if (isPipeSegment(input.fromCell, input.ball.direction, input.entryCoord, input.boardSize)) {
      return input.ball.speedMultiplier / 10;
    }

    if (input.currentEntity?.kind === 'slow-zone') {
      return 2.5;
    }

    return 1;
  }

  if (input.targetEntity?.kind === 'slow-zone') {
    return 2.5;
  }

  if (
    sameCoord(input.fromCell, input.entryCoord) &&
    sameCoord(input.toCell, innerEntryCell)
  ) {
    return input.ball.speedMultiplier;
  }
  // 进入外环管道时无论从哪里来都加速，但出口转内区时不加速
  if (isOuterRingCoord(input.toCell, input.boardSize) && !isOuterRingCoord(input.fromCell, input.boardSize)) {
    return input.ball.speedMultiplier;
  }

  if (isOuterRingCoord(input.toCell, input.boardSize) && isOuterRingCoord(input.fromCell, input.boardSize)) {
    return input.ball.speedMultiplier / 10;
  }

  return 1;
}

/** 判断 from→to 是否为外环管道段，入口右转进入内区不算。 */
export function isPipeSegment(
  fromCell: GridCoord,
  direction: Direction,
  entryCoord: GridCoord,
  boardSize: number,
): boolean {
  if (!isOuterRingCoord(fromCell, boardSize)) {
    return false;
  }
  if (sameCoord(fromCell, entryCoord) && direction === 'right') {
    return false;
  }
  return true;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled entity spec: ${JSON.stringify(value)}`);
}
