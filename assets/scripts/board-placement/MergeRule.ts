import { createShopPlacementSpec } from '../shop/ShopItemFactory.ts';
import { canMergePlacementItemWithEntity } from '../shared/entity-registry.ts';
import type {
  BoardDragItemDefinition,
  BoardPlacementPreview,
  Direction,
  EntitySpec,
  EntityState,
  GridCoord,
  ShopItemDefinition,
} from '../shared/types.ts';

/** 判断商店商品与目标实体是否满足当前项目的唯一合并条件。 */
export function getMergePreview(
  item: BoardDragItemDefinition,
  targetEntity: EntityState | null,
): Extract<BoardPlacementPreview['state'], 'mergeable' | 'blocked'> {
  if (!targetEntity) {
    return 'blocked';
  }

  if (!canMergePlacementItemWithEntity(item, targetEntity)) {
    return 'blocked';
  }

  if (item.kind === 'turner' && targetEntity.kind === 'turner') {
    return item.variant === targetEntity.variant && item.level === targetEntity.level
      ? 'mergeable'
      : 'blocked';
  }

  if (item.kind === 'weapon' && targetEntity.kind === 'weapon') {
    return item.weaponType === targetEntity.weaponType && item.level === targetEntity.level
      ? 'mergeable'
      : 'blocked';
  }

  if (item.kind === 'support' && targetEntity.kind === 'support') {
    return item.supportType === targetEntity.supportType && item.level === targetEntity.level
      ? 'mergeable'
      : 'blocked';
  }

  return 'blocked';
}

/**
 * 构建合并后的实体规格。
 * 武器合并必须保留已放置实体的朝向与充能，同时合并两边尾巴方向，避免丢失充能触发路径。
 */
export function buildMergedEntitySpec(
  item: BoardDragItemDefinition,
  targetEntity: EntityState,
): EntitySpec {
  if (item.kind === 'turner' && targetEntity.kind === 'turner') {
    return {
      kind: 'turner',
      coord: targetEntity.coord,
      variant: targetEntity.variant,
      level: targetEntity.level + 1,
    };
  }

  if (item.kind === 'weapon' && targetEntity.kind === 'weapon') {
    return {
      kind: 'weapon',
      coord: targetEntity.coord,
      weaponType: targetEntity.weaponType,
      level: targetEntity.level + 1,
      facing: targetEntity.facing,
      tailDirections: mergeTailDirections(targetEntity.tailDirections, getWeaponMergeTailDirections(item)),
      charge: targetEntity.charge,
    };
  }

  if (item.kind === 'support' && targetEntity.kind === 'support') {
    return {
      kind: 'support',
      coord: targetEntity.coord,
      supportType: targetEntity.supportType,
      level: Math.min(targetEntity.level + 1, 5),
    };
  }

  throw new Error('buildMergedEntitySpec requires a mergeable item/entity pair');
}

/** 空格放置时直接用商店商品生成 runtime 所需规格。 */
export function buildPlacedEntitySpec(item: ShopItemDefinition, coord: GridCoord): EntitySpec {
  return createShopPlacementSpec(item, coord);
}

function mergeTailDirections(
  targetTailDirections: Direction[],
  sourceTailDirections: Direction[],
): Direction[] {
  const mergedTailDirections: Direction[] = [...targetTailDirections];
  sourceTailDirections.forEach((direction) => {
    if (!mergedTailDirections.includes(direction)) {
      mergedTailDirections.push(direction);
    }
  });
  return mergedTailDirections;
}

function getWeaponMergeTailDirections(
  item: Extract<BoardDragItemDefinition, { kind: 'weapon' }>,
): Direction[] {
  return 'id' in item
    ? [...item.tailDirections]
    : [...(item.tailDirections ?? [item.facing])];
}
