import type {
  BoardDragItemDefinition,
  EntitySpec,
  EntityState,
  ShopItemDefinition,
} from './types.ts';

export type EntityKind = EntitySpec['kind'];

export type EntityDefinition = {
  kind: EntityKind;
  canDragFromBoard: boolean;
  canSwapOnBoard: boolean;
  canRecycleFromBoard: boolean;
  canMergeFromPlacement: boolean;
  canChargeFromTail: boolean;
  canAppearInRandomShop: boolean;
};

/**
 * Entity 元信息注册表。
 * 这里只保留会被跨模块实际读取的能力开关；具体行为仍由对应规则模块实现。
 */
export const ENTITY_DEFINITIONS = {
  turner: {
    kind: 'turner',
    canDragFromBoard: true,
    canSwapOnBoard: true,
    canRecycleFromBoard: true,
    canMergeFromPlacement: true,
    canChargeFromTail: false,
    canAppearInRandomShop: true,
  },
  rotator: {
    kind: 'rotator',
    canDragFromBoard: true,
    canSwapOnBoard: true,
    canRecycleFromBoard: false,
    canMergeFromPlacement: false,
    canChargeFromTail: false,
    canAppearInRandomShop: false,
  },
  weapon: {
    kind: 'weapon',
    canDragFromBoard: true,
    canSwapOnBoard: true,
    canRecycleFromBoard: true,
    canMergeFromPlacement: true,
    canChargeFromTail: true,
    canAppearInRandomShop: true,
  },
  'slow-zone': {
    kind: 'slow-zone',
    canDragFromBoard: false,
    canSwapOnBoard: false,
    canRecycleFromBoard: false,
    canMergeFromPlacement: false,
    canChargeFromTail: false,
    canAppearInRandomShop: false,
  },
  'chaos-gate': {
    kind: 'chaos-gate',
    canDragFromBoard: true,
    canSwapOnBoard: true,
    canRecycleFromBoard: false,
    canMergeFromPlacement: false,
    canChargeFromTail: false,
    canAppearInRandomShop: false,
  },
  'black-hole': {
    kind: 'black-hole',
    canDragFromBoard: true,
    canSwapOnBoard: true,
    canRecycleFromBoard: false,
    canMergeFromPlacement: false,
    canChargeFromTail: false,
    canAppearInRandomShop: false,
  },
  wreckage: {
    kind: 'wreckage',
    canDragFromBoard: false,
    canSwapOnBoard: false,
    canRecycleFromBoard: false,
    canMergeFromPlacement: false,
    canChargeFromTail: false,
    canAppearInRandomShop: false,
  },
  'ice-block': {
    kind: 'ice-block',
    canDragFromBoard: false,
    canSwapOnBoard: false,
    canRecycleFromBoard: false,
    canMergeFromPlacement: false,
    canChargeFromTail: false,
    canAppearInRandomShop: false,
  },
  stone: {
    kind: 'stone',
    canDragFromBoard: false,
    canSwapOnBoard: false,
    canRecycleFromBoard: false,
    canMergeFromPlacement: false,
    canChargeFromTail: false,
    canAppearInRandomShop: false,
  },
} as const satisfies Record<EntityKind, EntityDefinition>;

export const RANDOM_SHOP_ENTITY_KINDS = Object.values(ENTITY_DEFINITIONS)
  .filter((definition) => definition.canAppearInRandomShop)
  .map((definition) => definition.kind) as Array<ShopItemDefinition['kind']>;

export function getEntityDefinition(kind: EntityKind): EntityDefinition {
  return ENTITY_DEFINITIONS[kind];
}

export function canDragEntityFromBoard(entity: EntityState): boolean {
  return getEntityDefinition(entity.kind).canDragFromBoard;
}

export function canSwapEntityOnBoard(entity: EntityState): boolean {
  return getEntityDefinition(entity.kind).canSwapOnBoard;
}

export function canRecycleEntityFromBoard(entity: EntityState): boolean {
  return getEntityDefinition(entity.kind).canRecycleFromBoard;
}

export function canMergePlacementItemWithEntity(
  item: BoardDragItemDefinition,
  targetEntity: EntityState,
): boolean {
  return (
    item.kind === targetEntity.kind
    && getEntityDefinition(targetEntity.kind).canMergeFromPlacement
  );
}

export function canUseWeaponTailCharge(entity: EntityState): entity is Extract<EntityState, { kind: 'weapon' }> {
  return (
    entity.kind === 'weapon'
    && getEntityDefinition(entity.kind).canChargeFromTail
  );
}
