import {
  DIRECTIONS,
  TURNER_VARIANTS,
  WEAPON_TYPES,
} from '../shared/entity-definitions.ts';
import {
  getShopItemGoldPrice,
} from './shop-gold-rules.ts';
import type {
  EntitySpec,
  EntityState,
  GridCoord,
  ShopItemDefinition,
  TurnerShopItemDefinition,
  WeaponShopItemDefinition,
} from '../shared/types.ts';

/**
 * 生成商店商品列表。
 * 第一个槽位固定转向器，其余槽位按 50% 武器 / 50% 转向器生成。
 * 等级统一从 1 开始，避免把升级经济规则混入商店层。
 */
export function createRandomShopItems(
  count: number,
  randomFn: () => number = Math.random,
): ShopItemDefinition[] {
  return Array.from({ length: count }, (_, index) => createRandomShopItem(index, randomFn));
}

/** 根据商店商品定义生成可直接交给 runtime 的放置规格。 */
export function createShopPlacementSpec(item: ShopItemDefinition, coord: GridCoord): EntitySpec {
  if (item.kind === 'turner') {
    return {
      kind: 'turner',
      coord,
      variant: item.variant,
      level: item.level,
    };
  }

  return {
    kind: 'weapon',
    coord,
    weaponType: item.weaponType,
    facing: item.facing,
    tailDirections: [...(item.tailDirections ?? [item.facing])],
    level: item.level,
  };
}

/** 保留已放置实体的当前等级、朝向、尾巴与充能，用于空格搬迁。 */
export function createPlacementSpecFromEntity(
  entity: EntityState,
  coord: GridCoord,
): EntitySpec {
  switch (entity.kind) {
    case 'turner':
      return {
        kind: 'turner',
        coord,
        variant: entity.variant,
        level: entity.level,
      };
    case 'rotator':
      return {
        kind: 'rotator',
        coord,
        variant: entity.variant,
        level: entity.level,
      };
    case 'weapon':
      return {
        kind: 'weapon',
        coord,
        weaponType: entity.weaponType,
        facing: entity.facing,
        tailDirections: [...entity.tailDirections],
        level: entity.level,
        charge: entity.charge,
      };
    case 'slow-zone':
      return {
        kind: 'slow-zone',
        coord,
      };
    case 'chaos-gate':
      return {
        kind: 'chaos-gate',
        coord,
      };
    case 'black-hole':
      return {
        kind: 'black-hole',
        coord,
      };
    case 'wreckage':
      return {
        kind: 'wreckage',
        coord,
      };
    case 'ice-block':
      return {
        kind: 'ice-block',
        coord,
        durability: entity.durability,
      };
    case 'stone':
      return {
        kind: 'stone',
        coord,
      };
  }
}

function createRandomShopItem(index: number, randomFn: () => number): ShopItemDefinition {
  const itemId = `shop-item-${index}`;
  if (index === 0) {
    return createTurnerItem(itemId, randomFn);
  }

  return randomFn() < 0.5
    ? createWeaponItem(itemId, randomFn)
    : createTurnerItem(itemId, randomFn);
}

function createTurnerItem(itemId: string, randomFn: () => number): TurnerShopItemDefinition {
  const item: TurnerShopItemDefinition = {
    itemId,
    kind: 'turner',
    variant: TURNER_VARIANTS[getRandomIndex(TURNER_VARIANTS.length, randomFn)],
    level: 1,
    price: 0,
  };
  item.price = getShopItemGoldPrice(item);
  return item;
}

function createWeaponItem(itemId: string, randomFn: () => number): WeaponShopItemDefinition {
  const item: WeaponShopItemDefinition = {
    itemId,
    kind: 'weapon',
    weaponType: WEAPON_TYPES[getRandomIndex(WEAPON_TYPES.length, randomFn)],
    facing: DIRECTIONS[getRandomIndex(DIRECTIONS.length, randomFn)],
    tailDirections: undefined,
    level: 1,
    price: 0,
  };
  item.price = getShopItemGoldPrice(item);
  return item;
}

function getRandomIndex(length: number, randomFn: () => number): number {
  return Math.min(length - 1, Math.floor(randomFn() * length));
}
